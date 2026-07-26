import type { ProductBatch, SavedStockItem, SalesProduct } from "./types";
import { savedStockToSalesProduct } from "./stockItemMapper";
import { normalizeExpiryDate } from "@/lib/expiryDate";
export { normalizeExpiryDate };

export type StockProductOverride = {
  productId: string;
  barcode: string;
  batches: ProductBatch[];
};

export function mergeStockSeedData(
  seedProducts: SalesProduct[],
  savedItems: SavedStockItem[],
  overrides: StockProductOverride[],
): SalesProduct[] {
  const savedBarcodes = new Set(savedItems.map((item) => item.barcode.trim()));
  const products = [
    ...seedProducts.filter((product) => !savedBarcodes.has(product.barcode.trim())),
    ...savedItems.map(savedStockToSalesProduct),
  ];
  const overrideByKey = new Map<string, StockProductOverride>();

  overrides.forEach((override) => {
    overrideByKey.set(override.productId, override);
    overrideByKey.set(override.barcode.trim(), override);
  });

  return products.map((product) => {
    const override = overrideByKey.get(product.id) ?? overrideByKey.get(product.barcode.trim());
    const batches = (override?.batches ?? product.batches).map((batch) => ({
      ...batch,
      expiryDate: normalizeExpiryDate(batch.expiryDate),
    }));

    return { ...product, batches };
  });
}
