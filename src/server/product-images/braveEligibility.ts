export type BraveImageSearchEligibilityRow = {
  id: string;
  barcode: string;
  itemName: string;
  imageUrl: string;
  imageAsset: { id: string } | null;
  batches: Array<{ availableStock: number | string | { toString(): string } }>;
  imageResolutionError?: string | null;
  imageRetryAt?: Date | null;
};

export type BraveImageSearchEligibleProduct = {
  id: string;
  barcode: string;
  itemName: string;
  totalStock: number;
};

const PLACEHOLDER_TEXT = new Set([
  "n/a",
  "no image",
  "no image available",
  "none",
  "placeholder",
]);
const PLACEHOLDER_IMAGE_HOSTS = new Set(["placehold.co"]);

export function hasRealProductImage(imageUrl: string, hasImageAsset: boolean): boolean {
  if (hasImageAsset) return true;
  const normalized = imageUrl.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/api/product-images/")) return false;
  if (PLACEHOLDER_TEXT.has(normalized.toLocaleLowerCase("en-US"))) return false;
  try {
    const hostname = new URL(normalized).hostname.toLocaleLowerCase("en-US");
    if (PLACEHOLDER_IMAGE_HOSTS.has(hostname)) return false;
  } catch {
    // Non-placeholder text remains a real existing value and is not replaced.
  }
  return true;
}

function stockNumber(value: BraveImageSearchEligibilityRow["batches"][number]["availableStock"]): number {
  const parsed = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function selectBraveImageSearchEligibleProducts(
  rows: readonly BraveImageSearchEligibilityRow[],
  limit = Number.POSITIVE_INFINITY,
  options: {
    noResultMarker?: string;
    retryMarker?: string;
    now?: Date;
  } = {},
): BraveImageSearchEligibleProduct[] {
  const boundedLimit = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : rows.length;
  const now = options.now ?? new Date();
  return rows.flatMap((row) => {
    const barcode = row.barcode.replace(/\s+/g, " ").trim();
    const itemName = row.itemName.replace(/\s+/g, " ").trim();
    const totalStock = row.batches.reduce((sum, batch) => sum + stockNumber(batch.availableStock), 0);
    const isPermanentNoResult = Boolean(
      options.noResultMarker && row.imageResolutionError === options.noResultMarker,
    );
    const isWaitingAfterFailure = Boolean(
      options.retryMarker
      && row.imageResolutionError === options.retryMarker
      && row.imageRetryAt
      && row.imageRetryAt > now,
    );
    if (
      !barcode
      || !itemName
      || totalStock < 1
      || totalStock >= 200
      || isPermanentNoResult
      || isWaitingAfterFailure
      || hasRealProductImage(row.imageUrl, row.imageAsset !== null)
    ) return [];
    return [{ id: row.id, barcode, itemName, totalStock }];
  }).sort((left, right) => (
    right.totalStock - left.totalStock || left.id.localeCompare(right.id)
  )).slice(0, boundedLimit);
}
