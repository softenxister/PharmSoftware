import { isIsoExpiryDate } from "@/lib/expiryDate";

const MAX_DIRECT_STOCK_LINES = 100;
export const MAX_DIRECT_STOCK_QUANTITY = 999_999_999;

export type DirectStockAdjustmentInput = {
  productId: string;
  lines: Array<{
    batchNo: string;
    expiryDate: string;
    newQuantity: number;
  }>;
};

export type StockAdjustmentDraftLine = {
  batchNo: string;
  expiryDate: string;
  currentQuantity: number;
  newQuantity: string;
};

const isBoundedString = (value: unknown, maximumLength: number): value is string =>
  typeof value === "string"
  && value.trim().length > 0
  && value.trim().length <= maximumLength;

const isOptionalBoundedString = (value: unknown, maximumLength: number): value is string =>
  typeof value === "string" && value.trim().length <= maximumLength;

const isValidQuantity = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value >= 0
  && value <= MAX_DIRECT_STOCK_QUANTITY;

export function isValidDirectStockAdjustmentInput(
  value: unknown,
): value is DirectStockAdjustmentInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (!isBoundedString(input.productId, 200)) return false;
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > MAX_DIRECT_STOCK_LINES) {
    return false;
  }

  const batchNumbers = new Set<string>();
  return input.lines.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const line = candidate as Record<string, unknown>;
    if (
      !isOptionalBoundedString(line.batchNo, 200)
      || !isIsoExpiryDate(line.expiryDate, { allowEmpty: true })
      || !isValidQuantity(line.newQuantity)
    ) return false;
    const batchNo = line.batchNo.trim();
    const batchIdentity = `${batchNo}\0${line.expiryDate.trim()}`;
    if (batchNumbers.has(batchIdentity)) return false;
    batchNumbers.add(batchIdentity);
    return true;
  });
}

function parseDraftQuantity(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return isValidQuantity(quantity) ? quantity : null;
}

export function calculateStockAdjustment(lines: StockAdjustmentDraftLine[]) {
  const calculatedLines = lines.map((line) => {
    const nextQuantity = parseDraftQuantity(line.newQuantity);
    return {
      ...line,
      parsedQuantity: nextQuantity,
      change: nextQuantity === null ? null : nextQuantity - line.currentQuantity,
    };
  });
  const isValid = calculatedLines.length > 0
    && calculatedLines.every((line) => line.parsedQuantity !== null);
  const currentTotal = calculatedLines.reduce((total, line) => total + line.currentQuantity, 0);
  const finalTotal = isValid
    ? calculatedLines.reduce((total, line) => total + (line.parsedQuantity ?? 0), 0)
    : currentTotal;
  const totalChange = finalTotal - currentTotal;

  return {
    lines: calculatedLines,
    isValid,
    hasChanges: isValid && calculatedLines.some((line) => line.change !== 0),
    currentTotal,
    finalTotal,
    totalChange,
  };
}
