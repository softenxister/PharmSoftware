import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildManualProductImagePersistenceData,
  cleanupManualProductImageObjects,
  ManualProductImageImportError,
  persistManualProductImageImport,
  prepareManualProductImageImport,
} from "./manualImport";

test("manual image imports persist an approved candidate, private asset, and versioned product URL", () => {
  const reviewedAt = new Date("2026-07-25T08:00:00.000Z");
  const records = buildManualProductImagePersistenceData({
    productId: "product-1",
    sourceUrl: "https://cdn.example.com/products/item.png",
    storageKey: "product-images/product-1/abc.png",
    reviewedBy: "user-1",
    reviewedAt,
    image: {
      bytes: new Uint8Array([1, 2, 3]),
      sha256: "a".repeat(64),
      metadata: {
        mimeType: "image/png",
        width: 800,
        height: 800,
        byteSize: 3,
      },
    },
  });

  assert.equal(records.candidate.status, "APPROVED");
  assert.equal(records.candidate.provider, "MANUAL_URL");
  assert.equal(records.candidate.sourceImageUrl, "https://cdn.example.com/products/item.png");
  assert.equal(records.candidate.reviewedBy, "user-1");
  assert.equal(records.asset.storageKey, "product-images/product-1/abc.png");
  assert.equal(records.asset.sha256, "a".repeat(64));
  assert.equal(records.asset.sourceLicence, "USER_PROVIDED");
  assert.deepEqual(records.product, {
    imageUrl: `/api/product-images/product-1?v=${"a".repeat(64)}`,
    imageResolutionStatus: "VERIFIED",
    imageCheckedAt: reviewedAt,
    imageRetryAt: null,
    imageResolutionError: null,
  });
});

test("manual image persistence writes the approved candidate, asset, and product in one transaction", async () => {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const tx = {
    productImageCandidate: {
      upsert: async (input: unknown) => {
        calls.push({ operation: "candidate.upsert", input });
        return { id: "candidate-1" };
      },
      updateMany: async (input: unknown) => {
        calls.push({ operation: "candidate.updateMany", input });
        return { count: 0 };
      },
    },
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

  await persistManualProductImageImport(tx, {
    productId: "product-1",
    sourceUrl: "https://cdn.example.com/products/item.png",
    storageKey: "product-images/product-1/abc.png",
    reviewedBy: "user-1",
    image: {
      bytes: new Uint8Array([1, 2, 3]),
      sha256: "a".repeat(64),
      metadata: {
        mimeType: "image/png",
        width: 800,
        height: 800,
        byteSize: 3,
      },
    },
  });

  assert.deepEqual(calls.map((call) => call.operation), [
    "candidate.upsert",
    "asset.upsert",
    "candidate.updateMany",
    "product.update",
  ]);
  const assetInput = calls[1].input as {
    create: { candidateId: string; storageKey: string };
  };
  assert.equal(assetInput.create.candidateId, "candidate-1");
  assert.equal(assetInput.create.storageKey, "product-images/product-1/abc.png");
  const productInput = calls[3].input as {
    data: { imageUrl: string; imageResolutionStatus: string };
  };
  assert.equal(productInput.data.imageUrl, `/api/product-images/product-1?v=${"a".repeat(64)}`);
  assert.equal(productInput.data.imageResolutionStatus, "VERIFIED");
});

test("manual image import failures expose a safe actionable error", async () => {
  await assert.rejects(
    () => prepareManualProductImageImport("product-1", "http://cdn.example.com/item.png"),
    (error) => (
      error instanceof ManualProductImageImportError
      && error.message === "Photo could not be imported from that URL."
    ),
  );
});

test("manual image replacement cleanup keeps only the current object for that product", async () => {
  const calls: Array<{ prefix: string; keepKey: string }> = [];

  await cleanupManualProductImageObjects(
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
