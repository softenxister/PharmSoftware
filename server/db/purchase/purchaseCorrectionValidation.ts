import { isIsoExpiryDate } from "@/lib/expiryDate";

const isNonEmptyString = (value: unknown, maxLength = 200): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isBoundedString = (value: unknown, maxLength = 200): value is string =>
  typeof value === "string" && value.trim().length <= maxLength;

const isOptionalBoundedString = (
  value: unknown,
  maxLength = 200,
): value is string | null =>
  value === null || isBoundedString(value, maxLength);

const isUsefulReason = (value: unknown) =>
  typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 500;

export type CorrectionRequestInput = {
  purchaseBillId: string;
  reason: string;
};

export type StockAdjustmentInput = {
  purchaseBillId: string;
  correctionRequestId?: string;
  reason: string;
  lines: Array<{
    productId: string;
    batchNo: string | null;
    expiryDate: string;
    newQuantity: number;
  }>;
};

export const isValidCorrectionRequestInput = (value: unknown): value is CorrectionRequestInput => {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return isNonEmptyString(input.purchaseBillId) && isUsefulReason(input.reason);
};

export const isValidStockAdjustmentInput = (value: unknown): value is StockAdjustmentInput => {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (!isNonEmptyString(input.purchaseBillId) || !isUsefulReason(input.reason)) return false;
  if (input.correctionRequestId !== undefined && !isNonEmptyString(input.correctionRequestId)) return false;
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) return false;

  const batchKeys = new Set<string>();
  return input.lines.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const line = candidate as Record<string, unknown>;
    if (
      !isNonEmptyString(line.productId)
      || !isOptionalBoundedString(line.batchNo)
      || !isIsoExpiryDate(line.expiryDate)
    ) return false;
    const batchKey = JSON.stringify([
      line.productId.trim(),
      line.batchNo?.trim() ?? null,
      line.expiryDate.trim(),
    ]);
    if (batchKeys.has(batchKey)) return false;
    batchKeys.add(batchKey);
    return typeof line.newQuantity === "number"
      && Number.isFinite(line.newQuantity)
      && line.newQuantity >= 0;
  });
};
