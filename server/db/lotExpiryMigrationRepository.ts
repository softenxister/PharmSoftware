import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import { canonicalizeProductUnit } from "@/i18n/productUnits";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  extractLotExpiryItems,
  prepareLotExpiryMigration,
  type ExistingLotExpiryProduct,
  type LotExpiryMigrationPreview,
  type LotExpiryMigrationRow,
} from "@server/import/lotExpiryMigration";
import { prisma } from "./prisma";

type MigrationDb = Pick<Prisma.TransactionClient, "product">;

const LOT_EXPIRY_IMPORT_BATCH_SIZE = 1_000;

export const LOT_EXPIRY_MIGRATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 300_000,
} as const;

export class LotExpiryMigrationConfirmationError extends Error {}

export type LotExpiryMigrationResult = {
  migrationId: string;
  replacedProductCount: number;
  createdBatchCount: number;
  skippedUnmatchedCount: number;
  skippedConflictCount: number;
};

export type LotExpiryProductUnitWrite = {
  packUnit: string;
  productIds: string[];
};

function chunks<T>(rows: readonly T[]): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += LOT_EXPIRY_IMPORT_BATCH_SIZE) {
    output.push(rows.slice(index, index + LOT_EXPIRY_IMPORT_BATCH_SIZE));
  }
  return output;
}

async function readExistingLotExpiryProducts(
  client: MigrationDb = prisma,
): Promise<ExistingLotExpiryProduct[]> {
  const products = await client.product.findMany({
    where: { externalProductCode: { not: null } },
    select: {
      id: true,
      externalProductCode: true,
      itemName: true,
      packUnit: true,
      batches: {
        orderBy: [{ expiryDate: "asc" }, { batchNo: "asc" }],
        take: 1,
        select: { sellPriceThb: true },
      },
    },
  });
  return products.map((product) => ({
    id: product.id,
    externalProductCode: product.externalProductCode,
    itemName: product.itemName,
    baseUnit: product.packUnit,
    sellPriceThb: Number(product.batches[0]?.sellPriceThb ?? 0),
  }));
}

export function buildLotExpiryBatchWrites(
  row: LotExpiryMigrationRow,
  createId: (index: number) => string = () => randomUUID(),
): Prisma.ProductBatchCreateManyInput[] {
  if (
    row.status !== "matched"
    || !row.matchedProductId
    || row.sellPriceThb === null
  ) {
    throw new Error("Only matched lot and expiry rows can be written.");
  }
  return row.batches.map((batch, index) => ({
    id: createId(index),
    productId: row.matchedProductId as string,
    batchNo: normalizeOptionalBatchNo(batch.lotNo),
    expiryDate: batch.expiryDate,
    sellPriceThb: row.sellPriceThb as number,
    availableStock: batch.amount,
  }));
}

export function buildLotExpiryProductUnitWrites(
  rows: readonly LotExpiryMigrationRow[],
): LotExpiryProductUnitWrite[] {
  const productIdsByUnit = new Map<string, string[]>();
  for (const row of rows) {
    if (row.status !== "matched" || !row.matchedProductId) continue;
    const packUnit = canonicalizeProductUnit(row.unit);
    const productIds = productIdsByUnit.get(packUnit);
    if (productIds) productIds.push(row.matchedProductId);
    else productIdsByUnit.set(packUnit, [row.matchedProductId]);
  }
  return [...productIdsByUnit].map(([packUnit, productIds]) => ({ packUnit, productIds }));
}

function preparedMigration(
  fileName: string,
  bytes: Uint8Array,
  existingProducts: readonly ExistingLotExpiryProduct[],
) {
  const normalized = extractLotExpiryItems(fileName, bytes);
  return prepareLotExpiryMigration(normalized, existingProducts, bytes);
}

export async function previewLotExpiryMigration(
  fileName: string,
  bytes: Uint8Array,
): Promise<LotExpiryMigrationPreview> {
  const existingProducts = await readExistingLotExpiryProducts();
  return preparedMigration(fileName, bytes, existingProducts).preview;
}

export async function importLotExpiryMigration(
  fileName: string,
  bytes: Uint8Array,
  confirmationToken: string,
  user: Pick<PharmUser, "id" | "name">,
): Promise<LotExpiryMigrationResult> {
  return prisma.$transaction(async (tx) => {
    const existingProducts = await readExistingLotExpiryProducts(tx);
    const prepared = preparedMigration(fileName, bytes, existingProducts);
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new LotExpiryMigrationConfirmationError(
        "The selected file or product matching changed after preview. Preview it again before importing.",
      );
    }
    if (prepared.importRows.length === 0) {
      throw new LotExpiryMigrationConfirmationError(
        "No matched products remain to import.",
      );
    }

    const productIds = prepared.importRows.map((row) => row.matchedProductId as string);
    const previousStock = await tx.productBatch.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _sum: { availableStock: true },
    });
    const previousByProductId = new Map(previousStock.map((group) => [
      group.productId,
      Number(group._sum.availableStock ?? 0),
    ]));
    const batchWrites = prepared.importRows.flatMap((row) => buildLotExpiryBatchWrites(row));

    for (const unitWrite of buildLotExpiryProductUnitWrites(prepared.importRows)) {
      await tx.product.updateMany({
        where: { id: { in: unitWrite.productIds } },
        data: { packUnit: unitWrite.packUnit },
      });
    }
    await tx.productBatch.deleteMany({ where: { productId: { in: productIds } } });
    for (const batch of chunks(batchWrites)) {
      await tx.productBatch.createMany({ data: batch });
    }

    const migrationId = `lot-expiry-migration-${randomUUID()}`;
    await tx.stockAdjustment.create({
      data: {
        id: migrationId,
        reason: `CW lot & expiry migration · ${fileName.slice(0, 120)} · ${confirmationToken.slice(0, 12)}`,
        adjustedBy: user.name || user.id,
      },
    });
    const adjustmentLines: Prisma.StockAdjustmentLineCreateManyInput[] = prepared.importRows.map(
      (row, index) => {
        const productId = row.matchedProductId as string;
        const previousQuantity = previousByProductId.get(productId) ?? 0;
        return {
          id: `${migrationId}-line-${index + 1}`,
          stockAdjustmentId: migrationId,
          productId,
          batchNo: "CW-LOT-EXPIRY-IMPORT",
          previousQuantity,
          newQuantity: row.reportedAmount,
          delta: row.reportedAmount - previousQuantity,
        };
      },
    );
    for (const batch of chunks(adjustmentLines)) {
      await tx.stockAdjustmentLine.createMany({ data: batch });
    }

    return {
      migrationId,
      replacedProductCount: prepared.importRows.length,
      createdBatchCount: batchWrites.length,
      skippedUnmatchedCount: prepared.preview.summary.unmatchedProducts,
      skippedConflictCount: prepared.preview.summary.conflictProducts,
    };
  }, LOT_EXPIRY_MIGRATION_TRANSACTION_OPTIONS);
}
