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

export type PurchaseDiscountType = "percent" | "thb";
export type PurchaseDiscountTiming = "beforeVat" | "afterVat";

export type PurchaseLineEditorDraft = {
  unit: string;
  lineQty: string;
  lineCost: string;
  includeFreeQty: boolean;
  freeQty: string;
  freeUnit: string;
  lotNo: string;
  expiryDate: string;
};

export function getPurchaseLineEditorDraft(line: PurchaseLine): PurchaseLineEditorDraft {
  return {
    unit: line.unit,
    lineQty: line.qty,
    lineCost: line.cost,
    includeFreeQty: line.freeQty.trim().length > 0,
    freeQty: line.freeQty,
    freeUnit: line.freeUnit,
    lotNo: line.lotNo,
    expiryDate: line.expiryDate,
  };
}

export function applyPurchaseLineChange(
  lines: PurchaseLine[],
  nextLine: PurchaseLine,
  editingLineId: string | null,
): PurchaseLine[] {
  if (!editingLineId) return [...lines, nextLine];
  return lines.map((line) => (
    line.id === editingLineId ? { ...nextLine, id: line.id } : line
  ));
}

export function isPurchaseLineRowActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function getPurchaseLineEnterAction(
  key: string,
  flowField: string | undefined,
): "submit" | "advance" | "ignore" {
  if (key !== "Enter") return "ignore";
  return flowField === "expiry" ? "submit" : "advance";
}

export function getPurchaseUnitDisplayValue(value: string): string {
  return value.replace(/\[1\]$/, "");
}

export function selectPurchaseDiscountType(
  value: string,
  type: PurchaseDiscountType,
): { value: string; type: PurchaseDiscountType } {
  return { value, type };
}

export function positivePurchaseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundPurchaseCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function canSavePurchase(lineCount: number, netTotal: number): boolean {
  return Number.isInteger(lineCount)
    && lineCount > 0
    && Number.isFinite(netTotal)
    && netTotal > 0;
}

export function getDistributorMatches(
  distributors: string[],
  queryValue: string,
): string[] {
  const query = queryValue.trim().toLowerCase();
  const ranked = [...distributors].sort((first, second) => {
    const firstName = first.toLowerCase();
    const secondName = second.toLowerCase();
    const firstStarts = query ? Number(!firstName.startsWith(query)) : 0;
    const secondStarts = query ? Number(!secondName.startsWith(query)) : 0;
    return firstStarts - secondStarts || first.localeCompare(second);
  });
  if (!query) return ranked.slice(0, 6);
  return ranked
    .filter((name) => name.toLowerCase().includes(query))
    .slice(0, 6);
}

export function calculatePurchaseTotals(
  lines: Array<Pick<PurchaseLine, "qty" | "cost">>,
  vatIncluded: boolean,
  discount: string,
  discountType: PurchaseDiscountType,
  discountTiming: PurchaseDiscountTiming,
) {
  const totalQty = lines.reduce((sum, line) => sum + positivePurchaseNumber(line.qty), 0);
  const subtotal = lines.reduce((sum, line) => (
    sum + positivePurchaseNumber(line.qty) * positivePurchaseNumber(line.cost)
  ), 0);
  const discountValue = positivePurchaseNumber(discount);
  const vatBeforeDiscount = vatIncluded ? 0 : subtotal * 0.07;
  const discountBase = discountTiming === "afterVat"
    ? subtotal + vatBeforeDiscount
    : subtotal;
  const rawDiscountAmount = discountType === "percent"
    ? (discountBase * Math.min(discountValue, 100)) / 100
    : discountValue;
  const discountAmount = roundPurchaseCurrency(Math.min(rawDiscountAmount, discountBase));
  const discountedSubtotal = Math.max(subtotal - discountAmount, 0);
  const vatAmount = roundPurchaseCurrency(vatIncluded
    ? 0
    : discountTiming === "beforeVat"
      ? discountedSubtotal * 0.07
      : vatBeforeDiscount);
  const netTotal = discountTiming === "beforeVat"
    ? discountedSubtotal + vatAmount
    : subtotal + vatAmount - discountAmount;
  return {
    totalQty,
    subtotal,
    discountAmount,
    vatAmount,
    netTotal: roundPurchaseCurrency(Math.max(netTotal, 0)),
  };
}

export function calculatePurchaseLineActualCost(
  existingLines: Array<Pick<PurchaseLine, "qty" | "cost">>,
  draftLine: Pick<PurchaseLine, "qty" | "cost"> & Partial<Pick<
    PurchaseLine,
    "freeQty" | "freeUnitMultiplier" | "unitMultiplier"
  >>,
  vatIncluded: boolean,
  discount: string,
  discountType: PurchaseDiscountType,
  discountTiming: PurchaseDiscountTiming,
) {
  const quantity = positivePurchaseNumber(draftLine.qty);
  const enteredCost = positivePurchaseNumber(draftLine.cost);
  if (quantity === 0 || enteredCost === 0) {
    return { baseCost: enteredCost, discountPerUnit: 0, vatPerUnit: 0, actualCost: 0 };
  }

  const totals = calculatePurchaseTotals(
    [...existingLines, draftLine],
    vatIncluded,
    discount,
    discountType,
    discountTiming,
  );
  if (totals.subtotal === 0) {
    return { baseCost: enteredCost, discountPerUnit: 0, vatPerUnit: 0, actualCost: 0 };
  }

  const unitMultiplier = positivePurchaseNumber(String(draftLine.unitMultiplier ?? 1)) || 1;
  const freeUnitMultiplier = positivePurchaseNumber(String(draftLine.freeUnitMultiplier ?? 1)) || 1;
  const freeQuantity = positivePurchaseNumber(draftLine.freeQty ?? "");
  const paidLineSubtotal = quantity * enteredCost;
  const equivalentQuantity = quantity + ((freeQuantity * freeUnitMultiplier) / unitMultiplier);
  const lineAllocation = paidLineSubtotal / totals.subtotal;
  const baseCost = roundPurchaseCurrency(paidLineSubtotal / equivalentQuantity);
  const discountPerUnit = roundPurchaseCurrency(
    (totals.discountAmount * lineAllocation) / equivalentQuantity,
  );
  const vatPerUnit = roundPurchaseCurrency(
    (totals.vatAmount * lineAllocation) / equivalentQuantity,
  );
  return {
    baseCost,
    discountPerUnit,
    vatPerUnit,
    actualCost: roundPurchaseCurrency(Math.max(baseCost - discountPerUnit + vatPerUnit, 0)),
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
