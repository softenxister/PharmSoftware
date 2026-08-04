import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  prepareCwStockDetailUpdate,
  type CwStockDetailExistingProduct,
  type CwStockDetailUpdatePreview,
} from "@server/import/cwStockDetailUpdate";
import { prisma } from "../core/prisma";

type DetailUpdateReadClient = Pick<Prisma.TransactionClient, "product">;

export type CwStockDetailUpdateResult = {
  mode: "generic-cost-update";
  migrationId: string;
  updatedCount: number;
  unchangedCount: number;
  unmatchedCount: number;
  invalidCount: number;
};

export type CwStockDetailUpdateWrite = {
  id: string;
  migrationGenericName: string | null;
  migrationCostThb: number | null;
};

export class CwStockDetailUpdateConfirmationError extends Error {}

const DETAIL_UPDATE_BATCH_SIZE = 1_000;
export const CW_STOCK_DETAIL_UPDATE_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

export function buildCwStockDetailUpdateWrite(row: {
  matchedProductId: string;
  nextGenericName: string | null;
  nextCostThb: number | null;
}): CwStockDetailUpdateWrite {
  return {
    id: row.matchedProductId,
    migrationGenericName: row.nextGenericName,
    migrationCostThb: row.nextCostThb,
  };
}

async function readExistingProducts(
  client: DetailUpdateReadClient = prisma,
): Promise<CwStockDetailExistingProduct[]> {
  const products = await client.product.findMany({
    where: { externalProductCode: { not: null } },
    select: {
      id: true,
      externalProductCode: true,
      itemName: true,
      migrationGenericName: true,
      migrationCostThb: true,
    },
  });
  return products.flatMap((product) => product.externalProductCode ? [{
    id: product.id,
    externalProductCode: product.externalProductCode,
    itemName: product.itemName,
    migrationGenericName: product.migrationGenericName,
    migrationCostThb: product.migrationCostThb === null ? null : Number(product.migrationCostThb),
  }] : []);
}

export async function previewCwStockDetailUpdate(csvText: string): Promise<CwStockDetailUpdatePreview> {
  return prepareCwStockDetailUpdate(csvText, await readExistingProducts()).preview;
}

async function updateProductDetails(
  tx: Prisma.TransactionClient,
  writes: readonly CwStockDetailUpdateWrite[],
): Promise<void> {
  for (let index = 0; index < writes.length; index += DETAIL_UPDATE_BATCH_SIZE) {
    const batch = writes.slice(index, index + DETAIL_UPDATE_BATCH_SIZE);
    const values = batch.map((write) => Prisma.sql`(
      ${write.id}::text,
      ${write.migrationGenericName}::text,
      ${write.migrationCostThb}::decimal(16, 4)
    )`);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Product" AS product
      SET
        "migrationGenericName" = source."migrationGenericName",
        "migrationCostThb" = source."migrationCostThb",
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (VALUES ${Prisma.join(values)})
        AS source("id", "migrationGenericName", "migrationCostThb")
      WHERE product.id = source.id
    `);
  }
}

export async function importCwStockDetailUpdate(
  csvText: string,
  confirmationToken: string,
  fileName: string,
  user: Pick<PharmUser, "id" | "name">,
): Promise<CwStockDetailUpdateResult> {
  return prisma.$transaction(async (tx) => {
    const prepared = prepareCwStockDetailUpdate(csvText, await readExistingProducts(tx));
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new CwStockDetailUpdateConfirmationError(
        "The selected file or product matching changed after preview. Preview it again before updating.",
      );
    }
    if (prepared.importRows.length === 0) {
      throw new CwStockDetailUpdateConfirmationError(
        "No changed products remain. Review unmatched or invalid rows, then preview again.",
      );
    }
    const writes = prepared.importRows.map((row) => {
      if (!row.matchedProductId) {
        throw new Error("A changed CW product-detail row has no matched product.");
      }
      return buildCwStockDetailUpdateWrite({
        matchedProductId: row.matchedProductId,
        nextGenericName: row.nextGenericName,
        nextCostThb: row.nextCostThb,
      });
    });
    await updateProductDetails(tx, writes);

    const migrationId = `cw-product-detail-update-${randomUUID()}`;
    await tx.productDataImportRun.create({
      data: {
        id: migrationId,
        sourceSoftware: "CW",
        mode: "generic-cost-update",
        sourceFileName: fileName.slice(0, 255),
        sourceFileHash: createHash("sha256").update(csvText, "utf8").digest("hex"),
        importedBy: (user.name || user.id).slice(0, 255),
        changedCount: prepared.preview.summary.changedCount,
        unchangedCount: prepared.preview.summary.unchangedCount,
        unmatchedCount: prepared.preview.summary.unmatchedCount,
        invalidCount: prepared.preview.summary.invalidCount,
      },
    });
    return {
      mode: "generic-cost-update",
      migrationId,
      updatedCount: prepared.preview.summary.changedCount,
      unchangedCount: prepared.preview.summary.unchangedCount,
      unmatchedCount: prepared.preview.summary.unmatchedCount,
      invalidCount: prepared.preview.summary.invalidCount,
    };
  }, CW_STOCK_DETAIL_UPDATE_TRANSACTION_OPTIONS);
}
