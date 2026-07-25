import { isPlaceholderProductImageUrl } from "@/server/product-images/placeholder";
import { parseManualProductImageUrl } from "@/server/product-images/secureFetch";

export type StockPhotoUrlUpdate = {
  productId: string;
  photoUrl: string;
};

export function parseStockPhotoUrlUpdate(value: unknown): StockPhotoUrlUpdate | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.productId !== "string" || typeof input.photoUrl !== "string") return null;
  const productId = input.productId.trim();
  const photoUrl = input.photoUrl.trim();
  if (!productId || productId.length > 128 || !photoUrl || photoUrl.length > 4_096) return null;
  try {
    const source = parseManualProductImageUrl(photoUrl);
    if (!source || isPlaceholderProductImageUrl(source.toString())) return null;
    return { productId, photoUrl: source.toString() };
  } catch {
    return null;
  }
}
