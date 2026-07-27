import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkProductImageFailedItems,
  bulkProductImageWorkerCount,
  classifyBulkProductImageUrl,
} from "./storageMaintenance";

test("classifies exact managed API paths separately from genuine external HTTPS photos", () => {
  assert.deepEqual(
    classifyBulkProductImageUrl(
      "product-1",
      "http://127.0.0.1:3000/api/product-images/old-id?v=old",
    ),
    { kind: "managed", canonicalUrl: "/api/product-images/product-1" },
  );
  assert.deepEqual(
    classifyBulkProductImageUrl("product-1", "https://images.example.com/photo.jpg"),
    { kind: "external", sourceUrl: "https://images.example.com/photo.jpg" },
  );
  assert.equal(
    classifyBulkProductImageUrl("product-1", "https://placehold.co/400x400"),
    null,
  );
  assert.equal(
    classifyBulkProductImageUrl("product-1", "http://images.example.com/photo.jpg"),
    null,
  );
});

test("uses up to eight workers for network-bound bulk image storage", () => {
  assert.equal(bulkProductImageWorkerCount(0), 0);
  assert.equal(bulkProductImageWorkerCount(3), 3);
  assert.equal(bulkProductImageWorkerCount(56), 8);
});

test("builds a deterministic item-name log for failed bulk image storage", () => {
  const products = [
    { id: "product-1", itemName: "KERDICA" },
    { id: "product-2", itemName: "MYBACIN" },
    { id: "product-3", itemName: "Montulair" },
  ];

  assert.deepEqual(
    bulkProductImageFailedItems(products, new Set(["product-3", "product-1"])),
    [
      { productId: "product-1", itemName: "KERDICA" },
      { productId: "product-3", itemName: "Montulair" },
    ],
  );
});
