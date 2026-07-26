export type BulkProductImageStorageResult = {
  eligibleCount: number;
  processedCount: number;
  storedCount: number;
  repairedCount: number;
  failedCount: number;
  remainingCount: number;
  cleanupWarningCount: number;
};

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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
