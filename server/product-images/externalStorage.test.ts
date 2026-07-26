import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@server/generated/prisma/client";
import {
  buildStoredProductImagePersistenceData,
  cleanupStoredProductImageObjects,
  ExternalProductImageStorageError,
  persistStoredProductImage,
  prepareExternalProductImageStorage,
} from "./externalStorage";

const preparedImage = {
  productId: "product-1",
  sourceUrl: "https://cdn.example.com/products/item.png",
  storageKey: "product-images/product-1/abc.png",
  image: {
    bytes: new Uint8Array([1, 2, 3]),
    sha256: "a".repeat(64),
    metadata: {
      mimeType: "image/png" as const,
      width: 800,
      height: 800,
      byteSize: 3,
    },
  },
};

test("external image storage persists one private asset and versioned product URL", () => {
  const records = buildStoredProductImagePersistenceData(preparedImage);

  assert.deepEqual(records.asset, {
    storageKey: "product-images/product-1/abc.png",
    mimeType: "image/png",
    width: 800,
    height: 800,
    byteSize: 3,
    sha256: "a".repeat(64),
    sourceImageUrl: "https://cdn.example.com/products/item.png",
  });
  assert.deepEqual(records.product, {
    imageUrl: `/api/product-images/product-1?v=${"a".repeat(64)}`,
  });
});

test("external image storage writes only the asset and product records", async () => {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const tx = {
    productImageAsset: {
      upsert: async (input: unknown) => {
        calls.push({ operation: "asset.upsert", input });
        return {};
      },
    },
    product: {
      update: async (input: unknown) => {
        calls.push({ operation: "product.update", input });
        return {};
      },
    },
  } as unknown as Prisma.TransactionClient;

  await persistStoredProductImage(tx, preparedImage);

  assert.deepEqual(calls.map((call) => call.operation), [
    "asset.upsert",
    "product.update",
  ]);
  const assetInput = calls[0].input as {
    create: { productId: string; storageKey: string };
  };
  assert.equal(assetInput.create.productId, "product-1");
  assert.equal(assetInput.create.storageKey, "product-images/product-1/abc.png");
});

test("external image storage failures expose a safe actionable error", async () => {
  await assert.rejects(
    () => prepareExternalProductImageStorage("product-1", "http://cdn.example.com/item.png"),
    (error) => (
      error instanceof ExternalProductImageStorageError
      && error.message === "Photo could not be stored from that URL."
    ),
  );
});

test("stored image replacement cleanup keeps only the current object", async () => {
  const calls: Array<{ prefix: string; keepKey: string }> = [];

  await cleanupStoredProductImageObjects(
    "product/one",
    "product-images/product%2Fone/new-current.webp",
    {
      deleteOtherObjects: async (prefix, keepKey) => {
        calls.push({ prefix, keepKey });
      },
    },
  );

  assert.deepEqual(calls, [{
    prefix: "product-images/product%2Fone/",
    keepKey: "product-images/product%2Fone/new-current.webp",
  }]);
});
