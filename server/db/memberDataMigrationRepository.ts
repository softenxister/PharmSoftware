import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import {
  prepareMemberDataMigration,
  type ExistingCustomerIdentity,
  type MemberDataImportRow,
  type MemberDataMigrationPreview,
} from "@server/import/memberDataMigration";
import { prisma } from "./prisma";

type MigrationReadClient = Pick<Prisma.TransactionClient, "customer">;

export type MemberDataImportResult = {
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  importedCount: number;
};

export type MemberImportWrite = {
  where: { memberCode: string };
  create: {
    id: string;
    memberCode: string;
    name: string;
    mobile: string | null;
    address: string | null;
    isMember: true;
    points: 0;
    membershipRank: "Regular";
    createdAt: Date;
  };
  update: {
    name: string;
    mobile: string | null;
    address: string | null;
    isMember: true;
    createdAt: Date;
  };
};

export class MemberMigrationConfirmationError extends Error {}

export const MEMBER_DATA_IMPORT_BATCH_SIZE = 1_000;

export const MEMBER_DATA_MIGRATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

export function buildMemberImportWrite(row: MemberDataImportRow, id: string): MemberImportWrite {
  if (!row.membershipStartedAt) throw new Error(`Row ${row.rowNumber} has no valid membership start date.`);
  const profile = {
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    isMember: true as const,
    createdAt: row.membershipStartedAt,
  };
  return {
    where: { memberCode: row.memberCode },
    create: {
      id,
      memberCode: row.memberCode,
      ...profile,
      points: 0,
      membershipRank: "Regular",
    },
    update: profile,
  };
}

export async function readExistingCustomerIdentities(
  client: MigrationReadClient = prisma,
): Promise<ExistingCustomerIdentity[]> {
  return client.customer.findMany({
    select: { id: true, memberCode: true, mobile: true },
  });
}

export async function previewMemberDataMigration(csvText: string): Promise<MemberDataMigrationPreview> {
  const existingCustomers = await readExistingCustomerIdentities();
  return prepareMemberDataMigration(csvText, existingCustomers).preview;
}

async function upsertMemberRows(
  tx: Prisma.TransactionClient,
  rows: readonly MemberDataImportRow[],
): Promise<void> {
  for (let index = 0; index < rows.length; index += MEMBER_DATA_IMPORT_BATCH_SIZE) {
    const batch = rows.slice(index, index + MEMBER_DATA_IMPORT_BATCH_SIZE);
    const values = batch.map((row) => {
      const write = buildMemberImportWrite(row, `member-${randomUUID()}`);
      return Prisma.sql`(
        ${write.create.id}, ${write.create.memberCode}, ${write.create.name},
        ${write.create.mobile}, ${write.create.address}, ${write.create.isMember},
        ${write.create.points}, ${write.create.membershipRank}, ${write.create.createdAt},
        CURRENT_TIMESTAMP
      )`;
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Customer" (
        "id", "memberCode", "name", "mobile", "address", "isMember",
        "points", "membershipRank", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("memberCode") DO UPDATE SET
        "name" = EXCLUDED."name",
        "mobile" = EXCLUDED."mobile",
        "address" = EXCLUDED."address",
        "isMember" = true,
        "createdAt" = EXCLUDED."createdAt",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  }
}

export async function importMemberDataMigration(
  csvText: string,
  confirmationToken: string,
): Promise<MemberDataImportResult> {
  return prisma.$transaction(async (tx) => {
    const existingCustomers = await readExistingCustomerIdentities(tx);
    const prepared = prepareMemberDataMigration(csvText, existingCustomers);
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new MemberMigrationConfirmationError(
        "Member data changed after preview. Preview the file again before importing.",
      );
    }

    const importableRows = prepared.importRows.filter((row) => row.status !== "conflict");
    if (importableRows.length === 0) {
      throw new MemberMigrationConfirmationError(
        "No importable members remain. Fix the blocked rows and preview again.",
      );
    }
    await upsertMemberRows(tx, importableRows);

    return {
      migrationId: `member-migration-${randomUUID()}`,
      createdCount: prepared.preview.summary.newCount,
      updatedCount: prepared.preview.summary.updateCount,
      skippedConflictCount: prepared.preview.summary.conflictCount,
      importedCount: importableRows.length,
    };
  }, MEMBER_DATA_MIGRATION_TRANSACTION_OPTIONS);
}
