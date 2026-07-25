import { isPlaceholderProductImageUrl, productImageUrl } from "./placeholder";
import { buildProductImageStoragePrefix, type StoredObjectVersion } from "./s3Storage";

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

export type ProductImageStorageRecord = {
  productId: string;
  storageKey: string | null;
};

export type ProductImageVersionAnalysis = {
  deletableVersions: StoredObjectVersion[];
  duplicateProductCount: number;
  orphanedObjectCount: number;
  unsafeProductCount: number;
};

export function analyzeProductImageVersions(
  products: ProductImageStorageRecord[],
  versions: StoredObjectVersion[],
): ProductImageVersionAnalysis {
  const deletableVersions: StoredObjectVersion[] = [];
  let duplicateProductCount = 0;
  let orphanedObjectCount = 0;
  let unsafeProductCount = 0;

  for (const product of products) {
    const prefix = buildProductImageStoragePrefix(product.productId);
    const productVersions = versions.filter((version) => version.key.startsWith(prefix));
    if (!product.storageKey) {
      orphanedObjectCount += productVersions.length;
      continue;
    }
    const current = productVersions.filter((version) => (
      version.key === product.storageKey
      && version.isLatest
      && !version.isDeleteMarker
    ));
    if (current.length !== 1) {
      unsafeProductCount += 1;
      continue;
    }
    const obsolete = productVersions.filter((version) => version !== current[0]);
    if (obsolete.length > 0) {
      duplicateProductCount += 1;
      deletableVersions.push(...obsolete);
    }
  }

  return {
    deletableVersions,
    duplicateProductCount,
    orphanedObjectCount,
    unsafeProductCount,
  };
}
