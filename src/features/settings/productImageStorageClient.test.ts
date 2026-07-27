import assert from "node:assert/strict";
import test from "node:test";
import { storeExternalProductImages } from "./productImageStorageClient";

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
        failedItems: [{
          productId: "product-1",
          itemName: "KERDICA 20MG.10'S.",
        }],
      },
    });
  });
  assert.deepEqual(calls, [{ url: "/api/stock/photos", method: "POST" }]);
  assert.equal(result.processedCount, 500);
  assert.equal(result.remainingCount, 10);
  assert.deepEqual(result.failedItems, [{
    productId: "product-1",
    itemName: "KERDICA 20MG.10'S.",
  }]);
});

test("rejects malformed failed-item logs returned by the storage endpoint", async () => {
  await assert.rejects(() => storeExternalProductImages(async () => Response.json({
    result: {
      eligibleCount: 1,
      processedCount: 1,
      storedCount: 0,
      repairedCount: 0,
      failedCount: 1,
      remainingCount: 0,
      cleanupWarningCount: 0,
      failedItems: [{ productId: "product-1", itemName: null }],
    },
  })), /Unable to store external product photos/);
});
