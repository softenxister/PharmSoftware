import type { SavedStockItem, SalesProduct, StockItemInput } from "./types";

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "stock-item";
}

export function savedStockToSalesProduct(item: SavedStockItem): SalesProduct {
  const sellPrice = Number(item.sellPrice);
  const weightage = Number(item.weightage);
  const cleanWeightage = Number.isFinite(weightage) && weightage > 0 ? weightage : 1;
  const cleanSellPrice = Number.isFinite(sellPrice) && sellPrice > 0 ? sellPrice : 0;
  const brandName = item.brandName.trim() || item.manufacturer.trim() || item.itemName.trim();
  const manufacturerName = item.manufacturer.trim() || brandName;
  const category = item.itemCategory.trim();
  const location = item.location?.trim() || "-";
  const subUnit = item.subUnit?.trim() || item.unit.trim();
  const lotNo = item.lotNo?.trim() || `NEW-${item.barcode.trim().slice(-6) || "000000"}`;
  const expiryDate = item.expiryDate?.trim() || "";
  const imageUrl = item.photoUrl.trim() || `https://placehold.co/360x360/png?text=${encodeURIComponent(brandName.slice(0, 18))}`;
  const validPackagingRows = item.packagingRows.filter((row) => {
    const quantity = Number(row.childQuantity);
    return (
      row.parentUnit.trim().length > 0
      && row.childUnit.trim().length > 0
      && row.childQuantity.trim().length > 0
      && Number.isFinite(quantity)
      && quantity > 0
    );
  });

  return {
    id: item.id,
    itemName: item.itemName.trim(),
    brandName,
    manufacturerName,
    pack: {
      packUnit: item.unit.trim(),
      childUnit: subUnit,
      childQuantity: cleanWeightage,
      label: `${item.weightage.trim()} ${subUnit}`.trim(),
    },
    parentPacks: validPackagingRows.map((row) => {
      const quantity = Number(row.childQuantity);
      const cleanQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

      return {
        packUnit: row.parentUnit.trim(),
        childPackUnit: row.childUnit.trim(),
        childPackQuantity: cleanQuantity,
        label: `1 ${row.parentUnit.trim()} = ${cleanQuantity} ${row.childUnit.trim()}`,
        priceMultiplier: cleanQuantity,
      };
    }),
    location,
    barcode: item.barcode.trim(),
    category,
    imageUrl,
    weeklySold: 0,
    batches: [{
      batchNo: lotNo,
      expiryDate,
      sellPriceThb: cleanSellPrice,
      availableStock: 0,
    }],
  };
}

export function createSavedStockItem(input: StockItemInput, currentItem?: SavedStockItem): SavedStockItem {
  const now = new Date().toISOString();
  const barcode = input.barcode.trim();

  return {
    photoUrl: input.photoUrl.trim(),
    barcode,
    itemName: input.itemName.trim(),
    lotNo: input.lotNo.trim(),
    expiryDate: input.expiryDate.trim(),
    location: input.location.trim(),
    manufacturer: input.manufacturer.trim(),
    sellPrice: input.sellPrice.trim(),
    itemCategory: input.itemCategory.trim(),
    weightage: input.weightage.trim(),
    subUnit: input.subUnit?.trim() || input.unit.trim(),
    unit: input.unit.trim(),
    brandName: input.brandName.trim(),
    packagingRows: input.packagingRows
      .map((row) => ({
        parentUnit: row.parentUnit.trim(),
        childQuantity: row.childQuantity.trim(),
        childUnit: row.childUnit.trim(),
        barcode: row.barcode.trim(),
      }))
      .filter((row) => {
        const quantity = Number(row.childQuantity);
        return (
          row.parentUnit.length > 0
          && row.childUnit.length > 0
          && row.childQuantity.length > 0
          && Number.isFinite(quantity)
          && quantity > 0
        );
      }),
    id: currentItem?.id ?? `p-${slugify(input.itemName)}-${barcode.slice(-6)}`,
    createdAt: currentItem?.createdAt ?? now,
    updatedAt: now,
  };
}
