import type { StockItemInput } from "@server/db/types";

function comparableStockFields(item: StockItemInput) {
  return {
    productId: item.productId,
    barcode: item.barcode,
    barcodes: item.barcodes,
    itemName: item.itemName,
    lotNo: item.lotNo,
    expiryDate: item.expiryDate,
    location: item.location,
    manufacturer: item.manufacturer,
    sellPrice: item.sellPrice,
    itemCategory: item.itemCategory,
    weightage: item.weightage,
    subUnit: item.subUnit,
    unit: item.unit,
    brandName: item.brandName,
    packagingRows: item.packagingRows.map((row) => ({
      parentUnit: row.parentUnit,
      childQuantity: row.childQuantity,
      childUnit: row.childUnit,
      barcode: row.barcode,
      barcodes: row.barcodes,
      sellPrice: row.sellPrice,
    })),
  };
}

export function isStockPhotoUrlOnlyChange(
  original: StockItemInput,
  next: StockItemInput,
): boolean {
  if (original.photoUrl.trim() === next.photoUrl.trim()) return false;
  return JSON.stringify(comparableStockFields(original))
    === JSON.stringify(comparableStockFields(next));
}
