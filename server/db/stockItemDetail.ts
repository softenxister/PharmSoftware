import type { PharmUserRole } from "@server/auth/pharmUser";

export type StockDefaultDosage = [number, number, number, number];

export type StockItemDetailPatch = {
  productId: string;
  location: string;
  category: string;
  minimumStock: number;
  maximumStock: number;
  discountPercent: number;
  isDiscountLocked: boolean;
  isReturnable: boolean;
  defaultDosage: StockDefaultDosage;
  tagName: string;
};

const cleanText = (value: unknown, maximumLength: number, required = false): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if ((required && !cleaned) || cleaned.length > maximumLength) return null;
  return cleaned;
};

const isWholeNumberInRange = (value: unknown, minimum: number, maximum: number): value is number => (
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value >= minimum
  && value <= maximum
);

export function parseStockItemDetailPatch(value: unknown): StockItemDetailPatch | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const productId = cleanText(input.productId, 200, true);
  const location = cleanText(input.location, 80, true);
  const category = cleanText(input.category, 120, true);
  const tagName = cleanText(input.tagName, 60);
  if (!productId || !location || !category || tagName === null) return null;
  if (!isWholeNumberInRange(input.minimumStock, 0, 1_000_000)) return null;
  if (!isWholeNumberInRange(input.maximumStock, input.minimumStock, 1_000_000)) return null;
  if (!isWholeNumberInRange(input.discountPercent, 0, 100)) return null;
  if (typeof input.isDiscountLocked !== "boolean" || typeof input.isReturnable !== "boolean") return null;
  if (!Array.isArray(input.defaultDosage) || input.defaultDosage.length !== 4) return null;
  if (!input.defaultDosage.every((dose) => isWholeNumberInRange(dose, 0, 99))) return null;

  return {
    productId,
    location,
    category,
    minimumStock: input.minimumStock,
    maximumStock: input.maximumStock,
    discountPercent: input.discountPercent,
    isDiscountLocked: input.isDiscountLocked,
    isReturnable: input.isReturnable,
    defaultDosage: [...input.defaultDosage] as StockDefaultDosage,
    tagName,
  };
}

export const canRoleUpdateStockDiscount = (role: PharmUserRole): boolean => role === "owner";

export function hasForbiddenStockDiscountChange(
  role: PharmUserRole,
  current: Pick<StockItemDetailPatch, "discountPercent" | "isDiscountLocked">,
  requested: Pick<StockItemDetailPatch, "discountPercent" | "isDiscountLocked">,
): boolean {
  return !canRoleUpdateStockDiscount(role) && (
    current.discountPercent !== requested.discountPercent
    || current.isDiscountLocked !== requested.isDiscountLocked
  );
}
