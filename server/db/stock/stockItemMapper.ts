import type { SavedStockItem, SalesProduct, StockItemInput } from "../types";
import { canonicalizeProductUnit } from "@/i18n/productUnits";
import { productImageUrl } from "@server/product-images/placeholder";
import { normalizeExpiryDate } from "@/lib/expiryDate";
import { inferProductDosageForm } from "@/lib/productDosageForm";

type RelatedLineProduct = Pick<SalesProduct, "id" | "itemName" | "barcode" | "location">;

export function relatedLineUpdates(product: RelatedLineProduct) {
  return {
    purchaseLines: {
      where: { productId: product.id },
      data: { itemName: product.itemName, barcode: product.barcode },
    },
    saleLines: {
      where: { productId: product.id },
      data: { itemName: product.itemName, location: product.location },
    },
  };
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "stock-item";
}

export function normalizeBarcodeValues(
  primaryValue: string,
  aliases: readonly string[] = [],
): string[] {
  const seen = new Set<string>();
  return [primaryValue, ...aliases]
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function savedStockToSalesProduct(item: SavedStockItem): SalesProduct {
  const baseBarcodes = normalizeBarcodeValues(item.barcode, item.barcodes);
  const primaryBarcode = baseBarcodes[0] ?? "";
  const sellPrice = Number(item.sellPrice);
  const weightage = Number(item.weightage);
  const cleanWeightage = Number.isFinite(weightage) && weightage > 0 ? weightage : 1;
  const cleanSellPrice = Number.isFinite(sellPrice) && sellPrice > 0 ? sellPrice : 0;
  const brandName = item.brandName.trim() || item.manufacturer.trim() || item.itemName.trim();
  const manufacturerName = item.manufacturer.trim() || brandName;
  const category = item.itemCategory.trim();
  const location = item.location?.trim() || "-";
  const subUnit = canonicalizeProductUnit(item.subUnit?.trim() || item.unit.trim());
  const unit = canonicalizeProductUnit(item.unit);
  const lotNo = item.lotNo?.trim() || `NEW-${primaryBarcode.slice(-6) || "000000"}`;
  const expiryDate = normalizeExpiryDate(item.expiryDate);
  const imageUrl = item.photoUrl.trim() || productImageUrl(item.id);
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
      packUnit: unit,
      childUnit: subUnit,
      childQuantity: cleanWeightage,
      label: `${item.weightage.trim()} ${subUnit}`.trim(),
    },
    parentPacks: validPackagingRows.map((row) => {
      const quantity = Number(row.childQuantity);
      const cleanQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      const unitBarcodes = normalizeBarcodeValues(row.barcode, row.barcodes);
      const unitSellPrice = Number(row.sellPrice);

      return {
        packUnit: canonicalizeProductUnit(row.parentUnit),
        childPackUnit: canonicalizeProductUnit(row.childUnit),
        childPackQuantity: cleanQuantity,
        label: `1 ${canonicalizeProductUnit(row.parentUnit)} = ${cleanQuantity} ${canonicalizeProductUnit(row.childUnit)}`,
        priceMultiplier: cleanQuantity,
        ...(Number.isFinite(unitSellPrice) && unitSellPrice >= 0 ? { sellPriceThb: unitSellPrice } : {}),
        barcodes: unitBarcodes,
      };
    }),
    location,
    barcode: primaryBarcode,
    barcodes: baseBarcodes.slice(1),
    category,
    dosageForm: item.dosageForm ?? inferProductDosageForm({
      itemName: item.itemName,
      genericName: item.genericName,
      category,
      childUnit: subUnit,
      childQuantity: cleanWeightage,
    }).dosageForm,
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
  const baseBarcodes = normalizeBarcodeValues(input.barcode, input.barcodes);
  const barcode = baseBarcodes[0] ?? "";

  return {
    photoUrl: input.photoUrl.trim(),
    barcode,
    barcodes: baseBarcodes.slice(1),
    itemName: input.itemName.trim(),
    lotNo: input.lotNo.trim(),
    expiryDate: normalizeExpiryDate(input.expiryDate),
    location: input.location.trim(),
    manufacturer: input.manufacturer.trim(),
    sellPrice: input.sellPrice.trim(),
    itemCategory: input.itemCategory.trim(),
    weightage: input.weightage.trim(),
    subUnit: canonicalizeProductUnit(input.subUnit?.trim() || input.unit.trim()),
    unit: canonicalizeProductUnit(input.unit),
    brandName: input.brandName.trim(),
    ...(input.genericName === undefined ? {} : { genericName: input.genericName.trim() }),
    ...(input.legalCategory === undefined ? {} : { legalCategory: input.legalCategory.trim() }),
    ...(input.dosageForm === undefined ? {} : { dosageForm: input.dosageForm }),
    packagingRows: input.packagingRows
      .map((row) => {
        const barcodes = normalizeBarcodeValues(row.barcode, row.barcodes);
        return {
          parentUnit: canonicalizeProductUnit(row.parentUnit),
          childQuantity: row.childQuantity.trim(),
          childUnit: canonicalizeProductUnit(row.childUnit),
          barcode: barcodes[0] ?? "",
          barcodes: barcodes.slice(1),
          sellPrice: row.sellPrice?.trim() ?? "",
        };
      })
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
