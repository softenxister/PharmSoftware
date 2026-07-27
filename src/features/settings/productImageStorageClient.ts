export type BulkProductImageStorageResult = {
  eligibleCount: number;
  processedCount: number;
  storedCount: number;
  repairedCount: number;
  failedCount: number;
  remainingCount: number;
  cleanupWarningCount: number;
  failedItems: Array<{
    productId: string;
    itemName: string;
  }>;
};

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isFailedItem(value: unknown): value is BulkProductImageStorageResult["failedItems"][number] {
  if (!value || typeof value !== "object") return false;
  const item = value as { productId?: unknown; itemName?: unknown };
  return typeof item.productId === "string"
    && item.productId.trim().length > 0
    && typeof item.itemName === "string"
    && item.itemName.trim().length > 0;
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
  const failedItems = result?.failedItems ?? [];
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
    || !Array.isArray(failedItems)
    || failedItems.length > 500
    || !failedItems.every(isFailedItem)
  ) {
    throw new Error(errorMessage(body.error, "Unable to store external product photos."));
  }
  return {
    ...(result as Omit<BulkProductImageStorageResult, "failedItems">),
    failedItems,
  };
}
