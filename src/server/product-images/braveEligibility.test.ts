import assert from "node:assert/strict";
import test from "node:test";
import {
  selectBraveImageSearchEligibleProducts,
  type BraveImageSearchEligibilityRow,
} from "./braveEligibility";

function row(overrides: Partial<BraveImageSearchEligibilityRow>): BraveImageSearchEligibilityRow {
  return {
    id: "product",
    barcode: "8850000000001",
    itemName: "Item",
    imageUrl: "/api/product-images/product",
    imageAsset: null,
    batches: [{ availableStock: 1 }],
    ...overrides,
  };
}

test("selects stock 1 through 199 and orders highest stock first with a stable tie-breaker", () => {
  const selected = selectBraveImageSearchEligibleProducts([
    row({ id: "stock-0", batches: [{ availableStock: 0 }] }),
    row({ id: "stock-1", batches: [{ availableStock: 1 }] }),
    row({ id: "stock-199-b", batches: [{ availableStock: 99 }, { availableStock: 100 }] }),
    row({ id: "stock-199-a", batches: [{ availableStock: 199 }] }),
    row({ id: "stock-200", batches: [{ availableStock: 200 }] }),
  ]);

  assert.deepEqual(selected.map(({ id, totalStock }) => [id, totalStock]), [
    ["stock-199-a", 199],
    ["stock-199-b", 199],
    ["stock-1", 1],
  ]);
});

test("skips products with a real image, an asset, or missing barcode/name", () => {
  const selected = selectBraveImageSearchEligibleProducts([
    row({ id: "external", imageUrl: "https://example.test/real.jpg" }),
    row({ id: "data", imageUrl: "data:image/png;base64,abc" }),
    row({ id: "asset", imageAsset: { id: "asset-1" } }),
    row({ id: "no-barcode", barcode: " " }),
    row({ id: "no-name", itemName: " " }),
    row({ id: "placeholder", imageUrl: "/api/product-images/placeholder" }),
    row({
      id: "placeholder-service",
      imageUrl: "https://placehold.co/600x400?text=No+Image",
    }),
    row({ id: "blank", imageUrl: " " }),
  ]);

  assert.deepEqual(selected.map(({ id }) => id), [
    "blank",
    "placeholder",
    "placeholder-service",
  ]);
});

test("applies the requested cap after stock ordering", () => {
  const selected = selectBraveImageSearchEligibleProducts([
    row({ id: "low", batches: [{ availableStock: 2 }] }),
    row({ id: "high", batches: [{ availableStock: 150 }] }),
  ], 1);
  assert.deepEqual(selected.map(({ id }) => id), ["high"]);
});

test("skips prior no-result checks and failures that are still in their retry delay", () => {
  const now = new Date("2026-07-24T00:00:00.000Z");
  const selected = selectBraveImageSearchEligibleProducts([
    row({ id: "no-result", imageResolutionError: "BRAVE_NO_RESULT" }),
    row({
      id: "waiting",
      imageResolutionError: "BRAVE_RETRY",
      imageRetryAt: new Date("2026-07-25T00:00:00.000Z"),
    }),
    row({
      id: "retry-ready",
      imageResolutionError: "BRAVE_RETRY",
      imageRetryAt: new Date("2026-07-23T00:00:00.000Z"),
    }),
  ], 1000, {
    noResultMarker: "BRAVE_NO_RESULT",
    retryMarker: "BRAVE_RETRY",
    now,
  });

  assert.deepEqual(selected.map(({ id }) => id), ["retry-ready"]);
});
