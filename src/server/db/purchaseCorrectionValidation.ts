const isNonEmptyString = (value: unknown, maxLength = 200): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

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
    batchNo: string;
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
    if (!isNonEmptyString(line.productId) || !isNonEmptyString(line.batchNo)) return false;
    const batchKey = `${line.productId.trim()}::${line.batchNo.trim()}`;
    if (batchKeys.has(batchKey)) return false;
    batchKeys.add(batchKey);
    return typeof line.newQuantity === "number"
      && Number.isFinite(line.newQuantity)
      && line.newQuantity >= 0;
  });
};
