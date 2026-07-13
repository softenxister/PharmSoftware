export type StockDeleteRequest = {
  productId: string;
};

export function parseStockDeleteRequest(value: unknown): StockDeleteRequest | null {
  if (!value || typeof value !== "object") return null;
  const productId = (value as Record<string, unknown>).productId;
  if (typeof productId !== "string") return null;

  const normalizedProductId = productId.trim();
  if (!normalizedProductId || normalizedProductId.length > 128) return null;
  return { productId: normalizedProductId };
}
