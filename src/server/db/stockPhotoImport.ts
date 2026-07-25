import { parseManualProductImageUrl } from "@/server/product-images/secureFetch";

export type StockPhotoImportInput = {
  productId: string;
  photoUrl: string;
};

export function parseStockPhotoImportInput(value: unknown): StockPhotoImportInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.productId !== "string" || typeof input.photoUrl !== "string") return null;

  const productId = input.productId.trim();
  if (!productId || productId.length > 256) return null;
  try {
    const photoUrl = parseManualProductImageUrl(input.photoUrl);
    return photoUrl ? { productId, photoUrl: photoUrl.toString() } : null;
  } catch {
    return null;
  }
}
