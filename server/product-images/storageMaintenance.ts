import { isPlaceholderProductImageUrl, productImageUrl } from "./placeholder";

const MAX_BULK_PRODUCT_IMAGE_WORKERS = 8;

export type BulkProductImageFailedItem = {
  productId: string;
  itemName: string;
};

export type BulkProductImageUrl =
  | { kind: "managed"; canonicalUrl: string }
  | { kind: "external"; sourceUrl: string };

export function bulkProductImageFailedItems(
  products: readonly { id: string; itemName: string }[],
  failedProductIds: ReadonlySet<string>,
): BulkProductImageFailedItem[] {
  return products
    .filter((product) => failedProductIds.has(product.id))
    .map((product) => ({
      productId: product.id,
      itemName: product.itemName,
    }));
}

export function bulkProductImageWorkerCount(itemCount: number): number {
  return Math.min(MAX_BULK_PRODUCT_IMAGE_WORKERS, Math.max(0, Math.floor(itemCount)));
}

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
