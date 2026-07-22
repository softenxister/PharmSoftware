import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  extractDistributorSourceRows,
  prepareDistributorDataMigration,
  type DistributorDataMigrationPreview,
  type DistributorDataMigrationRow,
  type ExistingDistributorIdentity,
} from "@/server/import/distributorDataMigration";
import { prisma } from "./prisma";

type MigrationReadClient = Pick<Prisma.TransactionClient, "distributor">;

export type DistributorDataImportResult = {
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  importedCount: number;
};

export type DistributorImportWrite = {
  id: string;
  create: { id: string; code: string; name: string };
  update: { code: string; name: string };
};

export class DistributorMigrationConfirmationError extends Error {}

export const DISTRIBUTOR_DATA_IMPORT_BATCH_SIZE = 1_000;
export const DISTRIBUTOR_DATA_MIGRATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

export function buildDistributorImportWrite(
  row: DistributorDataMigrationRow,
  generatedId: string,
): DistributorImportWrite {
  const id = row.matchedDistributorId ?? generatedId;
  const values = { code: row.code, name: row.name };
  return { id, create: { id, ...values }, update: values };
}

export async function readExistingDistributorIdentities(
  client: MigrationReadClient = prisma,
): Promise<ExistingDistributorIdentity[]> {
  return client.distributor.findMany({ select: { id: true, code: true, name: true } });
}

function prepare(fileName: string, bytes: Uint8Array, existing: readonly ExistingDistributorIdentity[]) {
  return prepareDistributorDataMigration(extractDistributorSourceRows(fileName, bytes), existing, bytes);
}

export async function previewDistributorDataMigration(
  fileName: string,
  bytes: Uint8Array,
): Promise<DistributorDataMigrationPreview> {
  return prepare(fileName, bytes, await readExistingDistributorIdentities()).preview;
}

async function writeDistributorRows(
  tx: Prisma.TransactionClient,
  rows: readonly DistributorDataMigrationRow[],
): Promise<void> {
  for (let index = 0; index < rows.length; index += DISTRIBUTOR_DATA_IMPORT_BATCH_SIZE) {
    const entries = rows.slice(index, index + DISTRIBUTOR_DATA_IMPORT_BATCH_SIZE)
      .map((row) => ({ row, write: buildDistributorImportWrite(row, `distributor-${randomUUID()}`) }));
    const updates = entries.filter(({ row }) => row.matchedDistributorId).map(({ write }) => write);
    const creates = entries.filter(({ row }) => !row.matchedDistributorId).map(({ write }) => write);

    if (updates.length > 0) {
      const values = updates.map((write) => Prisma.sql`(${write.id}, ${write.update.code}, ${write.update.name})`);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Distributor" AS distributor
        SET
          "code" = source."code",
          "name" = source."name",
          "updatedAt" = CURRENT_TIMESTAMP
        FROM (VALUES ${Prisma.join(values)}) AS source("id", "code", "name")
        WHERE distributor."id" = source."id"
      `);
    }
    if (creates.length > 0) {
      const values = creates.map((write) => Prisma.sql`(
        ${write.create.id}, ${write.create.code}, ${write.create.name}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "Distributor" ("id", "code", "name", "createdAt", "updatedAt")
        VALUES ${Prisma.join(values)}
      `);
    }
  }
}

export async function importDistributorDataMigration(
  fileName: string,
  bytes: Uint8Array,
  confirmationToken: string,
): Promise<DistributorDataImportResult> {
  return prisma.$transaction(async (tx) => {
    const prepared = prepare(fileName, bytes, await readExistingDistributorIdentities(tx));
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new DistributorMigrationConfirmationError(
        "Distributor data changed after preview. Preview the file again before importing.",
      );
    }
    const importableRows = prepared.importRows.filter((row) => row.status !== "conflict");
    if (importableRows.length === 0) {
      throw new DistributorMigrationConfirmationError(
        "No importable distributors remain. Fix the blocked rows and preview again.",
      );
    }
    await writeDistributorRows(tx, importableRows);
    return {
      migrationId: `distributor-migration-${randomUUID()}`,
      createdCount: prepared.preview.summary.newCount,
      updatedCount: prepared.preview.summary.updateCount,
      skippedConflictCount: prepared.preview.summary.conflictCount,
      importedCount: importableRows.length,
    };
  }, DISTRIBUTOR_DATA_MIGRATION_TRANSACTION_OPTIONS);
}
