import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import { replaceDeprecatedProductUnit } from "@/i18n/productUnits";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  prepareCwStockMigration,
  type CwExistingProductIdentity,
  type CwStockMigrationPreview,
} from "@server/import/cwStockMigration";
import { resolveImportedBrandName } from "@server/import/thaiBrandExtractor";
import { prisma } from "./prisma";

type MigrationDb = Pick<Prisma.TransactionClient, "product">;

type CwProductWrite = {
  id: string;
  externalProductCode: string;
  barcode: string;
  itemName: string;
  brandName: string;
  manufacturerId: string;
  categoryId: string;
  baseUnit: string;
  isActive: boolean;
};

export const CW_STOCK_IMPORT_BATCH_SIZE = 1_000;

export function chunkCwStockImportRows<T>(rows: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += CW_STOCK_IMPORT_BATCH_SIZE) {
    batches.push(rows.slice(index, index + CW_STOCK_IMPORT_BATCH_SIZE));
  }
  return batches;
}

export type CwStockImportResult = {
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  stockReplacedCount: number;
};

export class CwMigrationConfirmationError extends Error {}

export const CW_STOCK_MIGRATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 300_000,
} as const;

async function readCwExistingProductIdentities(
  client: MigrationDb = prisma,
): Promise<CwExistingProductIdentity[]> {
  const products = await client.product.findMany({
    select: {
      id: true,
      externalProductCode: true,
      itemName: true,
      barcode: true,
      barcodeAliases: { select: { barcode: true } },
      parentPacks: {
        select: {
          barcode: true,
          barcodeAliases: { select: { barcode: true } },
        },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    externalProductCode: product.externalProductCode,
    itemName: product.itemName,
    barcodes: [...new Set([
      product.barcode,
      ...product.barcodeAliases.map((alias) => alias.barcode),
      ...product.parentPacks.flatMap((pack) => [
        ...(pack.barcode ? [pack.barcode] : []),
        ...pack.barcodeAliases.map((alias) => alias.barcode),
      ]),
    ])],
  }));
}

export async function previewCwStockMigration(csvText: string): Promise<CwStockMigrationPreview> {
  const existingProducts = await readCwExistingProductIdentities();
  return prepareCwStockMigration(csvText, existingProducts).preview;
}

function newProductId(externalProductCode: string): string {
  const code = externalProductCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `cw-${code || "product"}-${randomUUID().slice(0, 8)}`;
}

async function upsertProductsInBatches(
  tx: Prisma.TransactionClient,
  products: readonly CwProductWrite[],
): Promise<void> {
  for (const batch of chunkCwStockImportRows(products)) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Product" (
        "id", "externalProductCode", "barcode", "itemName", "brandName",
        "manufacturerId", "categoryId", "packUnit", "childUnit", "childQuantity",
        "packLabel", "location", "imageUrl", "isActive", "updatedAt"
      )
      VALUES ${Prisma.join(batch.map((product) => Prisma.sql`(
        ${product.id},
        ${product.externalProductCode},
        ${product.barcode},
        ${product.itemName},
        ${product.brandName},
        ${product.manufacturerId},
        ${product.categoryId},
        ${product.baseUnit},
        ${product.baseUnit},
        ${1},
        ${`1 ${product.baseUnit}`},
        ${"-"},
        ${`https://placehold.co/360x360/png?text=${encodeURIComponent(product.itemName.slice(0, 18))}`},
        ${product.isActive},
        CURRENT_TIMESTAMP
      )`))}
      ON CONFLICT ("id") DO UPDATE SET
        "externalProductCode" = EXCLUDED."externalProductCode",
        "barcode" = EXCLUDED."barcode",
        "itemName" = EXCLUDED."itemName",
        "brandName" = EXCLUDED."brandName",
        "manufacturerId" = EXCLUDED."manufacturerId",
        "categoryId" = EXCLUDED."categoryId",
        "packUnit" = EXCLUDED."packUnit",
        "childUnit" = EXCLUDED."childUnit",
        "childQuantity" = EXCLUDED."childQuantity",
        "packLabel" = EXCLUDED."packLabel",
        "isActive" = EXCLUDED."isActive",
        "compositionStatus" = CASE
          WHEN "Product"."barcode" IS DISTINCT FROM EXCLUDED."barcode"
            OR "Product"."itemName" IS DISTINCT FROM EXCLUDED."itemName"
            OR "Product"."manufacturerId" IS DISTINCT FROM EXCLUDED."manufacturerId"
          THEN 'PENDING'::"ProductCompositionStatus"
          ELSE "Product"."compositionStatus"
        END,
        "compositionCheckedAt" = CASE
          WHEN "Product"."barcode" IS DISTINCT FROM EXCLUDED."barcode"
            OR "Product"."itemName" IS DISTINCT FROM EXCLUDED."itemName"
            OR "Product"."manufacturerId" IS DISTINCT FROM EXCLUDED."manufacturerId"
          THEN NULL
          ELSE "Product"."compositionCheckedAt"
        END,
        "compositionRetryAt" = CASE
          WHEN "Product"."barcode" IS DISTINCT FROM EXCLUDED."barcode"
            OR "Product"."itemName" IS DISTINCT FROM EXCLUDED."itemName"
            OR "Product"."manufacturerId" IS DISTINCT FROM EXCLUDED."manufacturerId"
          THEN NULL
          ELSE "Product"."compositionRetryAt"
        END,
        "compositionError" = CASE
          WHEN "Product"."barcode" IS DISTINCT FROM EXCLUDED."barcode"
            OR "Product"."itemName" IS DISTINCT FROM EXCLUDED."itemName"
            OR "Product"."manufacturerId" IS DISTINCT FROM EXCLUDED."manufacturerId"
          THEN NULL
          ELSE "Product"."compositionError"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  }
}

async function upsertMigrationBatches(
  tx: Prisma.TransactionClient,
  batches: readonly Prisma.ProductBatchCreateManyInput[],
): Promise<void> {
  for (const batch of chunkCwStockImportRows(batches)) {
    const values = batch.map((item) => Prisma.sql`(
      ${item.id}, ${item.productId}, ${item.batchNo}, ${item.expiryDate},
      ${item.sellPriceThb}, ${item.availableStock}, CURRENT_TIMESTAMP
    )`);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductBatch" (
        "id", "productId", "batchNo", "expiryDate", "sellPriceThb", "availableStock", "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("productId", "batchNo", "expiryDate") DO UPDATE SET
        "sellPriceThb" = EXCLUDED."sellPriceThb",
        "availableStock" = EXCLUDED."availableStock",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  }
}

async function createManyInBatches<T>(
  rows: readonly T[],
  create: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (const batch of chunkCwStockImportRows(rows)) await create(batch);
}

export async function importCwStockMigration(
  csvText: string,
  confirmationToken: string,
  fileName: string,
  user: Pick<PharmUser, "id" | "name">,
): Promise<CwStockImportResult> {
  return prisma.$transaction(async (tx) => {
    const existingProducts = await readCwExistingProductIdentities(tx);
    const prepared = prepareCwStockMigration(csvText, existingProducts);
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new CwMigrationConfirmationError("The selected file changed after preview. Preview it again before importing.");
    }

    const importableRows = prepared.preview.rows.filter((row) => row.status !== "conflict");
    if (importableRows.length === 0) {
      throw new CwMigrationConfirmationError("No importable products remain. Resolve the conflicts and preview again.");
    }
    const productsByCode = new Map(
      prepared.normalized.products.map((product) => [product.externalProductCode, product]),
    );
    const unitsByCode = new Map<string, typeof prepared.normalized.units>();
    for (const unit of prepared.normalized.units) {
      const units = unitsByCode.get(unit.externalProductCode) ?? [];
      units.push(unit);
      unitsByCode.set(unit.externalProductCode, units);
    }

    const matchedProductIds = importableRows.flatMap((row) => (
      row.matchedProductId ? [row.matchedProductId] : []
    ));
    const [currentProducts, previousStockGroups] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: matchedProductIds } },
        select: {
          id: true,
          barcode: true,
          itemName: true,
          brandName: true,
          manufacturerId: true,
        },
      }),
      tx.productBatch.groupBy({
        by: ["productId"],
        where: { productId: { in: matchedProductIds } },
        _sum: { availableStock: true },
      }),
    ]);
    const currentById = new Map(currentProducts.map((product) => [product.id, product]));
    const previousStockByProductId = new Map(previousStockGroups.map((group) => [
      group.productId,
      Number(group._sum.availableStock ?? 0),
    ]));

    const sources = importableRows.map((row) => {
      const source = productsByCode.get(row.externalProductCode);
      const units = unitsByCode.get(row.externalProductCode);
      const baseUnit = units?.find((unit) => unit.isBaseUnit);
      if (!source || !units || !baseUnit) {
        throw new Error("CW migration source row could not be resolved.");
      }
      const current = row.matchedProductId ? currentById.get(row.matchedProductId) : null;
      if (row.matchedProductId && !current) {
        throw new Error("CW migration matched product could not be resolved.");
      }
      return { row, source, units, baseUnit, current };
    });

    const categoryNames = [...new Set(sources.map(({ source }) => source.category))];
    const manufacturerNames = [...new Set(sources.map(({ source }) => source.manufacturerName))];
    await tx.category.createMany({ data: categoryNames.map((name) => ({ name })), skipDuplicates: true });
    await tx.manufacturer.createMany({
      data: manufacturerNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const [categories, manufacturers] = await Promise.all([
      tx.category.findMany({ where: { name: { in: categoryNames } }, select: { id: true, name: true } }),
      tx.manufacturer.findMany({
        where: { name: { in: manufacturerNames } },
        select: { id: true, name: true },
      }),
    ]);
    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
    const manufacturerIdByName = new Map(manufacturers.map((manufacturer) => [
      manufacturer.name,
      manufacturer.id,
    ]));

    const productWrites: CwProductWrite[] = [];
    const identityChangedProductIds: string[] = [];
    const parentPacks: Prisma.ProductParentPackCreateManyInput[] = [];
    const barcodeAliases: Prisma.ProductBarcodeAliasCreateManyInput[] = [];
    const migrationBatches: Prisma.ProductBatchCreateManyInput[] = [];
    const adjustmentInputs: Array<{
      productId: string;
      previousQuantity: number;
      newQuantity: number;
    }> = [];

    for (const { source, units, baseUnit, current } of sources) {
      const manufacturerId = manufacturerIdByName.get(source.manufacturerName);
      const categoryId = categoryIdByName.get(source.category);
      if (!manufacturerId || !categoryId) throw new Error("CW migration reference data could not be resolved.");
      const productId = current?.id ?? newProductId(source.externalProductCode);
      if (current && (
        current.barcode !== source.baseBarcode
        || current.itemName !== source.itemName
        || current.manufacturerId !== manufacturerId
      )) {
        identityChangedProductIds.push(productId);
      }
      productWrites.push({
        id: productId,
        externalProductCode: source.externalProductCode,
        barcode: source.baseBarcode,
        itemName: source.itemName,
        brandName: resolveImportedBrandName({
          extractedBrandName: source.brandName,
          existingBrandName: current?.brandName,
          existingItemName: current?.itemName,
        }),
        manufacturerId,
        categoryId,
        baseUnit: replaceDeprecatedProductUnit(source.baseUnit),
        isActive: source.isActive,
      });

      barcodeAliases.push(...baseUnit.barcodes.slice(1).map((barcode) => ({ productId, barcode })));
      for (const unit of units) {
        if (unit.isBaseUnit) continue;
        const parentPackId = randomUUID();
        parentPacks.push({
          id: parentPackId,
          productId,
          packUnit: replaceDeprecatedProductUnit(unit.unitName),
          childPackUnit: replaceDeprecatedProductUnit(source.baseUnit),
          childPackQuantity: unit.quantityInBaseUnit,
          label: `1 ${replaceDeprecatedProductUnit(unit.unitName)} = ${unit.quantityInBaseUnit} ${replaceDeprecatedProductUnit(source.baseUnit)}`,
          priceMultiplier: unit.quantityInBaseUnit,
          sellPriceThb: unit.sellPriceThb,
          barcode: unit.barcodes[0] ?? null,
        });
        barcodeAliases.push(...unit.barcodes.slice(1).map((barcode) => ({
          productId,
          parentPackId,
          barcode,
        })));
      }
      migrationBatches.push({
        id: randomUUID(),
        productId,
        batchNo: "CW-MIGRATION",
        expiryDate: "",
        sellPriceThb: source.baseSellPriceThb,
        availableStock: source.availableStock,
      });
      adjustmentInputs.push({
        productId,
        previousQuantity: previousStockByProductId.get(productId) ?? 0,
        newQuantity: source.availableStock,
      });
    }

    await upsertProductsInBatches(tx, productWrites);
    const productIds = productWrites.map((product) => product.id);
    if (identityChangedProductIds.length > 0) {
      await tx.productIngredient.deleteMany({ where: { productId: { in: identityChangedProductIds } } });
    }
    await tx.productBarcodeAlias.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productParentPack.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productBatch.updateMany({
      where: { productId: { in: productIds } },
      data: { availableStock: 0 },
    });
    await createManyInBatches(parentPacks, (data) => tx.productParentPack.createMany({ data }));
    await createManyInBatches(barcodeAliases, (data) => tx.productBarcodeAlias.createMany({ data }));
    await upsertMigrationBatches(tx, migrationBatches);

    const migrationId = `cw-migration-${randomUUID()}`;
    await tx.stockAdjustment.create({
      data: {
        id: migrationId,
        reason: `CW stock migration · ${fileName.slice(0, 120)} · ${confirmationToken.slice(0, 12)}`,
        adjustedBy: user.name || user.id,
      },
    });
    const adjustmentLines: Prisma.StockAdjustmentLineCreateManyInput[] = adjustmentInputs.map((line) => ({
      id: randomUUID(),
      stockAdjustmentId: migrationId,
      productId: line.productId,
      batchNo: "CW-MIGRATION",
      previousQuantity: line.previousQuantity,
      newQuantity: line.newQuantity,
      delta: line.newQuantity - line.previousQuantity,
    }));
    await createManyInBatches(adjustmentLines, (data) => tx.stockAdjustmentLine.createMany({ data }));

    return {
      migrationId,
      createdCount: prepared.preview.summary.newCount,
      updatedCount: prepared.preview.summary.updateCount,
      skippedConflictCount: prepared.preview.summary.conflictCount,
      stockReplacedCount: importableRows.length,
    };
  }, CW_STOCK_MIGRATION_TRANSACTION_OPTIONS);
}
