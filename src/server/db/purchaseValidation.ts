import { isIsoExpiryDate } from "@/lib/expiryDate";

type ValidationOptions = {
  requireId?: boolean;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isOptionalBatchNo = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim().length <= 200);

const isValidPurchaseLine = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return ["id", "productId", "barcode", "itemName", "unit", "freeUnit"]
    .every((field) => isNonEmptyString(line[field]))
    && isOptionalBatchNo(line.batchNo)
    && isIsoExpiryDate(line.expiryDate)
    && isFinitePositiveNumber(line.unitMultiplier)
    && isFinitePositiveNumber(line.quantity)
    && isFinitePositiveNumber(line.cost)
    && isFinitePositiveNumber(line.freeUnitMultiplier)
    && typeof line.freeQuantity === "number"
    && Number.isFinite(line.freeQuantity)
    && line.freeQuantity >= 0;
};

export const isValidPurchaseBillInput = (value: unknown, options: ValidationOptions = {}) => {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (options.requireId && !isNonEmptyString(input.id)) return false;
  if (!options.requireId && input.id !== undefined) return false;
  if (input.invoiceNo !== undefined && typeof input.invoiceNo !== "string") return false;
  if (input.distributor !== undefined && typeof input.distributor !== "string") return false;
  if (input.status !== undefined && !["received", "draft", "partial"].includes(String(input.status))) return false;

  return isFinitePositiveNumber(input.totalQty)
    && isFinitePositiveNumber(input.netTotal)
    && Array.isArray(input.lines)
    && input.lines.length > 0
    && input.lines.every(isValidPurchaseLine);
};
