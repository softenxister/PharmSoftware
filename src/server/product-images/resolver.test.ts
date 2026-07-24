import assert from "node:assert/strict";
import test from "node:test";
import type { ProductImageProviderCandidate } from "./providers/types";
import {
  extractProductImageIdentity,
  resolveOneProductImage,
  type ProductImageResolverDependencies,
  type ResolvableProduct,
} from "./resolver";

const product: ResolvableProduct = {
  id: "product-1",
  itemName: "TYLENOL 500MG 10'S TABLETS",
  brandName: "Tylenol",
  manufacturerName: "Kenvue",
  market: "TH",
  barcodes: [{ value: "4006381333931", packageLevel: "EACH" }],
  ingredientNames: ["Paracetamol"],
};

const candidate: ProductImageProviderCandidate = {
  provider: "OPEN_PRODUCTS_FACTS",
  sourcePageUrl: "https://world.openfoodfacts.org/product/4006381333931",
  sourceImageUrl: "https://images.openfoodfacts.org/example.png",
  sourceLicence: "CC BY-SA 3.0",
  matchMethod: "EXACT_GTIN",
  sourceIdentifierType: "GTIN",
  sourceIdentifierValue: "04006381333931",
  sourceProductName: "Tylenol Paracetamol 500mg tablets 10",
  sourceBrand: "Tylenol",
  sourceManufacturer: "Kenvue",
  sourceMarket: "TH",
  sourcePackCount: "10",
};

function dependencies(overrides: Partial<ProductImageResolverDependencies> = {}) {
  const events: Array<{ type: string; value?: unknown }> = [];
  const deps: ProductImageResolverDependencies = {
    provider: {
      name: "OPEN_PRODUCTS_FACTS",
      allowedImageHosts: ["images.openfoodfacts.org"],
      findByGtin: async () => candidate,
    },
    validateImage: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      sha256: "a".repeat(64),
      metadata: { mimeType: "image/png", width: 900, height: 700, byteSize: 3 },
    }),
    saveCandidate: async (input) => {
      events.push({ type: "candidate", value: input });
      return "candidate-1";
    },
    publishCandidate: async (input) => {
      events.push({ type: "published", value: input });
    },
    markUnresolved: async (reason) => {
      events.push({ type: "unresolved", value: reason });
    },
    markRetry: async (reason) => {
      events.push({ type: "retry", value: reason });
    },
    canPublish: true,
    ...overrides,
  };
  return { deps, events };
}

test("extracts strength, dosage form, pack count, and ingredient without an LLM", () => {
  assert.deepEqual(extractProductImageIdentity(product), {
    productName: "TYLENOL 500MG 10'S TABLETS",
    brand: "Tylenol",
    manufacturer: "Kenvue",
    ingredient: "Paracetamol",
    strength: "500MG",
    dosageForm: "tablet",
    packCount: "10",
    market: "TH",
  });
});

test("publishes an exact, conflict-free, licensed, validated identifier match", async () => {
  const { deps, events } = dependencies();
  const result = await resolveOneProductImage(product, deps);

  assert.deepEqual(result, { outcome: "VERIFIED", candidateId: "candidate-1" });
  assert.deepEqual(events.map((event) => event.type), ["candidate", "published"]);
});

test("queues an exact candidate for review when S3 is not configured", async () => {
  const { deps, events } = dependencies({ canPublish: false });
  const result = await resolveOneProductImage(product, deps);

  assert.deepEqual(result, { outcome: "REVIEW", candidateId: "candidate-1" });
  assert.deepEqual(events.map((event) => event.type), ["candidate"]);
});

test("rejects a hard conflict and leaves the product unresolved", async () => {
  const { deps, events } = dependencies({
    provider: {
      name: "OPEN_PRODUCTS_FACTS",
      allowedImageHosts: ["images.openfoodfacts.org"],
      findByGtin: async () => ({ ...candidate, sourcePackCount: "20" }),
    },
  });
  const result = await resolveOneProductImage(product, deps);

  assert.deepEqual(result, { outcome: "UNRESOLVED" });
  assert.deepEqual(events.map((event) => event.type), ["candidate", "unresolved"]);
  const saved = events[0].value as { status: string };
  assert.equal(saved.status, "REJECTED");
});

test("does not call a provider for products without a valid GTIN", async () => {
  let providerCalls = 0;
  const { deps, events } = dependencies({
    provider: {
      name: "OPEN_PRODUCTS_FACTS",
      allowedImageHosts: [],
      findByGtin: async () => {
        providerCalls += 1;
        return null;
      },
    },
  });
  const result = await resolveOneProductImage({
    ...product,
    barcodes: [{ value: "internal-123", packageLevel: "EACH" }],
  }, deps);

  assert.deepEqual(result, { outcome: "UNRESOLVED" });
  assert.equal(providerCalls, 0);
  assert.deepEqual(events.map((event) => event.type), ["unresolved"]);
});

test("records bounded retry state when the provider is unavailable", async () => {
  const { deps, events } = dependencies({
    provider: {
      name: "OPEN_PRODUCTS_FACTS",
      allowedImageHosts: [],
      findByGtin: async () => {
        throw new Error("upstream internal detail");
      },
    },
  });
  const result = await resolveOneProductImage(product, deps);

  assert.deepEqual(result, { outcome: "PENDING" });
  assert.deepEqual(events, [{
    type: "retry",
    value: "The product image provider is temporarily unavailable.",
  }]);
});
