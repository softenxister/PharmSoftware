import { Prisma } from "@server/generated/prisma/client";
import type { SalesProduct } from "../types";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { normalizeExpiryDate } from "@/lib/expiryDate";

export const productGraph = {
  category: true,
  manufacturer: true,
  barcodeAliases: true,
  parentPacks: {
    include: { barcodeAliases: true },
    orderBy: [
      { packUnit: "asc" as const },
      { childPackUnit: "asc" as const },
      { childPackQuantity: "asc" as const },
    ],
  },
  batches: { orderBy: [{ expiryDate: "asc" as const }, { batchNo: "asc" as const }] },
  activeIngredients: {
    orderBy: { ingredient: { canonicalName: "asc" as const } },
    include: { ingredient: true },
  },
};

export type StockProductRow = Prisma.ProductGetPayload<{ include: typeof productGraph }>;

export function stockBatchIdentityKey(
  productId: string,
  batchNo: string | null | undefined,
  expiryDate: string,
): string {
  return JSON.stringify([productId, normalizeOptionalBatchNo(batchNo), normalizeExpiryDate(expiryDate)]);
}

export function productRowToSalesProduct(
  product: StockProductRow,
  batchCosts: ReadonlyMap<string, number> = new Map(),
  weeklySold?: number,
): SalesProduct {
  return {
    id: product.id,
    ...(product.externalProductCode ? { externalProductCode: product.externalProductCode } : {}),
    itemName: product.itemName,
    brandName: product.brandName,
    manufacturerName: product.manufacturer.name,
    pack: {
      packUnit: product.packUnit,
      childUnit: product.childUnit,
      childQuantity: Number(product.childQuantity),
      label: product.packLabel,
    },
    parentPacks: product.parentPacks.map((pack) => ({
      id: pack.id,
      packUnit: pack.packUnit,
      childPackUnit: pack.childPackUnit,
      childPackQuantity: Number(pack.childPackQuantity),
      label: pack.label,
      priceMultiplier: Number(pack.priceMultiplier),
      ...(pack.sellPriceThb === null ? {} : { sellPriceThb: Number(pack.sellPriceThb) }),
      barcodes: [
        ...(pack.barcode ? [pack.barcode] : []),
        ...pack.barcodeAliases.map((alias) => alias.barcode),
      ],
    })),
    location: product.location,
    minimumStock: product.minimumStock,
    maximumStock: product.maximumStock,
    discountPercent: product.discountPercent,
    isDiscountLocked: product.isDiscountLocked,
    isReturnable: product.isReturnable,
    defaultDosage: [
      product.defaultDoseMorning,
      product.defaultDoseNoon,
      product.defaultDoseEvening,
      product.defaultDoseNight,
    ],
    tagName: product.tagName,
    barcode: product.barcode,
    barcodes: product.barcodeAliases
      .filter((alias) => alias.parentPackId === null)
      .map((alias) => alias.barcode),
    category: product.category.name,
    imageUrl: product.imageUrl,
    weeklySold: weeklySold ?? product.weeklySold,
    compositionStatus: product.compositionStatus.toLowerCase() as SalesProduct["compositionStatus"],
    activeIngredients: product.activeIngredients.map(({ ingredient, strength, sourceName, sourceUrl }) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
      ...(strength ? { strength } : {}),
      sourceName,
      sourceUrl,
    })),
    batches: product.batches.map((batch) => ({
      batchNo: batch.batchNo ?? "",
      expiryDate: normalizeExpiryDate(batch.expiryDate),
      sellPriceThb: Number(batch.sellPriceThb),
      costThb: batchCosts.get(stockBatchIdentityKey(product.id, batch.batchNo, batch.expiryDate)),
      availableStock: Number(batch.availableStock),
    })),
  };
}
