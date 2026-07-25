import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanStoredImageDuplicates,
  previewStoredImageCleanup,
  storeExternalProductImages,
} from "./productImageStorageClient";

test("stores external images through one bounded maintenance request", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const result = await storeExternalProductImages(async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    return Response.json({
      result: {
        eligibleCount: 510,
        processedCount: 500,
        storedCount: 4,
        repairedCount: 495,
        failedCount: 1,
        remainingCount: 10,
        cleanupWarningCount: 2,
      },
    });
  });
  assert.deepEqual(calls, [{ url: "/api/stock/photos", method: "POST" }]);
  assert.equal(result.processedCount, 500);
  assert.equal(result.remainingCount, 10);
});

test("previews and confirms the same encoded cleanup batch cursor", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    urls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return Response.json({
      data: {
        batchCursor: "product/500",
        nextCursor: null,
        scannedCount: 500,
        duplicateProductCount: 2,
        oldVersionCount: 3,
        orphanedObjectCount: 1,
        unsafeProductCount: 0,
        ...(init?.method === "POST"
          ? { deletedVersionCount: 3, cleanupFailedCount: 0 }
          : {}),
      },
    });
  };

  await previewStoredImageCleanup("product/500", fetcher);
  const result = await cleanStoredImageDuplicates("product/500", fetcher);
  assert.deepEqual(urls, [
    "GET /api/product-image-storage?cursor=product%2F500",
    "POST /api/product-image-storage?cursor=product%2F500",
  ]);
  assert.equal(result.deletedVersionCount, 3);
});
