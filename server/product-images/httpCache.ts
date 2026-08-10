type ProductImageAssetHeaders = {
  byteSize: number;
  mimeType: string;
  sha256: string;
};

const IMMUTABLE_PRIVATE_CACHE = "private, max-age=31536000, immutable";
const MUTABLE_PRIVATE_CACHE = "private, max-age=86400";

export function productImageResponseHeaders(
  asset: ProductImageAssetHeaders,
  requestedVersion: string | null,
): Headers {
  return new Headers({
    "cache-control": requestedVersion === asset.sha256
      ? IMMUTABLE_PRIVATE_CACHE
      : MUTABLE_PRIVATE_CACHE,
    "content-length": String(asset.byteSize),
    "content-type": asset.mimeType,
    etag: `"${asset.sha256}"`,
    "x-content-type-options": "nosniff",
  });
}

export function isProductImageNotModified(
  ifNoneMatch: string | null,
  opaqueTag: string,
): boolean {
  if (!ifNoneMatch) return false;
  const expected = `"${opaqueTag}"`;
  return ifNoneMatch.split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || tag === expected || tag === `W/${expected}`;
  });
}
