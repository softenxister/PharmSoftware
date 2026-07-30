import type { SalesProduct } from "@server/db/types";

export type PurchaseLine = {
  id: string;
  productId: string;
  barcode: string;
  imageUrl: string;
  itemName: string;
  unit: string;
  unitMultiplier: number;
  qty: string;
  cost: string;
  freeQty: string;
  freeUnit: string;
  freeUnitMultiplier: number;
  lotNo: string;
  expiryDate: string;
};

export type EditablePurchaseBill = {
  id: string;
  invoiceNo: string;
  distributor: string;
  status: "received" | "draft" | "partial";
  lines: Array<{
    id: string;
    productId: string;
    barcode: string;
    itemName: string;
    unit: string;
    unitMultiplier: number;
    quantity: number;
    cost: number;
    freeUnit: string;
    freeUnitMultiplier: number;
    freeQuantity: number;
    batchNo: string | null;
    expiryDate: string;
  }>;
};

export type CurrentPharmUser = {
  name: string;
  role: "owner" | "pharmacist";
  canManageStock: boolean;
};

export type PurchaseCorrection = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
};

export function positivePurchaseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function calculatePurchaseTotals(
  lines: Array<Pick<PurchaseLine, "qty" | "cost">>,
  vatIncluded: boolean,
  adjustment: string,
  adjustmentType: "percent" | "thb",
) {
  const totalQty = lines.reduce((sum, line) => sum + positivePurchaseNumber(line.qty), 0);
  const subtotal = lines.reduce((sum, line) => (
    sum + positivePurchaseNumber(line.qty) * positivePurchaseNumber(line.cost)
  ), 0);
  const adjustmentValue = positivePurchaseNumber(adjustment);
  const adjustmentAmount = adjustmentType === "percent"
    ? (subtotal * Math.min(adjustmentValue, 99)) / 100
    : adjustmentValue;
  const vatAmount = vatIncluded ? 0 : subtotal * 0.07;
  return {
    totalQty,
    subtotal,
    adjustmentAmount,
    vatAmount,
    netTotal: Math.max(subtotal + vatAmount + adjustmentAmount, 0),
  };
}

export function getPurchaseItemSearchPriority(
  product: SalesProduct,
  rawQuery: string,
): number | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;
  if (/^\d{5,}$/.test(query)) {
    const barcodes = [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ];
    return barcodes.some((barcode) => barcode.includes(query)) ? 0 : null;
  }
  const itemName = product.itemName.toLowerCase();
  const brand = product.brandName.toLowerCase();
  const manufacturer = product.manufacturerName.toLowerCase();
  if (itemName.startsWith(query)) return 1;
  if (itemName.includes(query)) return 2;
  if (brand.startsWith(query)) return 3;
  if (brand.includes(query)) return 4;
  if (manufacturer.startsWith(query)) return 5;
  if (manufacturer.includes(query)) return 6;
  return null;
}

export function mergePurchaseCatalog(
  current: SalesProduct[],
  incoming: SalesProduct[],
): SalesProduct[] {
  const incomingIds = new Set(incoming.map(({ id }) => id));
  return [...incoming, ...current.filter(({ id }) => !incomingIds.has(id))].slice(0, 200);
}

export function purchaseUnitMultiplier(product: SalesProduct, packUnit: string): number {
  if (
    packUnit === product.pack.packUnit
    || packUnit === `${product.pack.packUnit}[1]`
  ) return 1;
  return product.parentPacks.find((pack) => (
    `${pack.packUnit}[${pack.childPackQuantity}]` === packUnit
  ))?.childPackQuantity ?? 1;
}
