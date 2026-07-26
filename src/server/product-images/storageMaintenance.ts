import { isPlaceholderProductImageUrl, productImageUrl } from "./placeholder";

export type BulkProductImageUrl =
  | { kind: "managed"; canonicalUrl: string }
  | { kind: "external"; sourceUrl: string };

export function classifyBulkProductImageUrl(
  productId: string,
  imageUrl: string,
): BulkProductImageUrl | null {
  let source: URL;
  try {
    source = new URL(imageUrl);
  } catch {
    return null;
  }
  if (
    /^\/api\/product-images\/[^/]+$/.test(source.pathname)
    && (source.protocol === "http:" || source.protocol === "https:")
  ) {
    return { kind: "managed", canonicalUrl: productImageUrl(productId) };
  }
  if (
    source.protocol !== "https:"
    || source.username
    || source.password
    || isPlaceholderProductImageUrl(source.toString())
  ) {
    return null;
  }
  return { kind: "external", sourceUrl: source.toString() };
}
