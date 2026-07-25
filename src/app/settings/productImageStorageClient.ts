export type BulkProductImageStorageResult = {
  eligibleCount: number;
  processedCount: number;
  storedCount: number;
  repairedCount: number;
  failedCount: number;
  remainingCount: number;
  cleanupWarningCount: number;
};

export type ProductImageCleanupPreview = {
  batchCursor: string | null;
  nextCursor: string | null;
  scannedCount: number;
  duplicateProductCount: number;
  oldVersionCount: number;
  orphanedObjectCount: number;
  unsafeProductCount: number;
};

export type ProductImageCleanupResult = ProductImageCleanupPreview & {
  deletedVersionCount: number;
  cleanupFailedCount: number;
};

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isCleanupPreview(value: unknown): value is ProductImageCleanupPreview {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ProductImageCleanupPreview>;
  return (data.batchCursor === null || typeof data.batchCursor === "string")
    && (data.nextCursor === null || typeof data.nextCursor === "string")
    && isCount(data.scannedCount)
    && isCount(data.duplicateProductCount)
    && isCount(data.oldVersionCount)
    && isCount(data.orphanedObjectCount)
    && isCount(data.unsafeProductCount);
}

function isCleanupResult(value: unknown): value is ProductImageCleanupResult {
  return isCleanupPreview(value)
    && isCount((value as Partial<ProductImageCleanupResult>).deletedVersionCount)
    && isCount((value as Partial<ProductImageCleanupResult>).cleanupFailedCount);
}

async function payload(response: Response): Promise<{ data?: unknown; result?: unknown; error?: unknown }> {
  const value: unknown = await response.json().catch(() => null);
  return value && typeof value === "object" ? value : {};
}

function errorMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function storeExternalProductImages(
  fetcher: typeof fetch = fetch,
): Promise<BulkProductImageStorageResult> {
  const response = await fetcher("/api/stock/photos", { method: "POST" });
  const body = await payload(response);
  const result = body.result as Partial<BulkProductImageStorageResult> | undefined;
  if (
    !response.ok
    || !result
    || !isCount(result.eligibleCount)
    || !isCount(result.processedCount)
    || !isCount(result.storedCount)
    || !isCount(result.repairedCount)
    || !isCount(result.failedCount)
    || !isCount(result.remainingCount)
    || !isCount(result.cleanupWarningCount)
  ) {
    throw new Error(errorMessage(body.error, "Unable to store external product photos."));
  }
  return result as BulkProductImageStorageResult;
}

function cleanupUrl(cursor: string | null): string {
  return cursor
    ? `/api/product-image-storage?cursor=${encodeURIComponent(cursor)}`
    : "/api/product-image-storage";
}

export async function previewStoredImageCleanup(
  cursor: string | null,
  fetcher: typeof fetch = fetch,
): Promise<ProductImageCleanupPreview> {
  const response = await fetcher(cleanupUrl(cursor), { cache: "no-store" });
  const body = await payload(response);
  if (!response.ok || !isCleanupPreview(body.data)) {
    throw new Error(errorMessage(body.error, "Unable to inspect stored product images."));
  }
  return body.data;
}

export async function cleanStoredImageDuplicates(
  cursor: string | null,
  fetcher: typeof fetch = fetch,
): Promise<ProductImageCleanupResult> {
  const response = await fetcher(cleanupUrl(cursor), { method: "POST" });
  const body = await payload(response);
  if (!response.ok || !isCleanupResult(body.data)) {
    throw new Error(errorMessage(body.error, "Unable to clean stored product images."));
  }
  return body.data;
}
