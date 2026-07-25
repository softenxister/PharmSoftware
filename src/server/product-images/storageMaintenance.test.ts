import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeProductImageVersions,
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

test("preserves one current asset version and separates duplicates from unowned objects", () => {
  const result = analyzeProductImageVersions(
    [
      { productId: "p1", storageKey: "product-images/p1/current.webp" },
      { productId: "p2", storageKey: null },
    ],
    [
      {
        key: "product-images/p1/current.webp",
        versionId: "current",
        isLatest: true,
        isDeleteMarker: false,
      },
      {
        key: "product-images/p1/old.webp",
        versionId: "old",
        isLatest: false,
        isDeleteMarker: false,
      },
      {
        key: "product-images/p2/orphan.webp",
        versionId: "orphan",
        isLatest: true,
        isDeleteMarker: false,
      },
    ],
  );

  assert.deepEqual(result.deletableVersions.map(({ versionId }) => versionId), ["old"]);
  assert.equal(result.duplicateProductCount, 1);
  assert.equal(result.orphanedObjectCount, 1);
  assert.equal(result.unsafeProductCount, 0);
});

test("refuses cleanup when the recorded asset is not the unique latest object", () => {
  const result = analyzeProductImageVersions(
    [{ productId: "p1", storageKey: "product-images/p1/current.webp" }],
    [{
      key: "product-images/p1/old.webp",
      versionId: "old",
      isLatest: true,
      isDeleteMarker: false,
    }],
  );

  assert.equal(result.deletableVersions.length, 0);
  assert.equal(result.unsafeProductCount, 1);
});
