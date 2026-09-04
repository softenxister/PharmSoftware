import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  createProductEditorLifecycle,
  type ProductEditorAdapter,
  type ProductEditorInventory,
} from "./productEditorLifecycle";
import { productToStockItemInput } from "./productItemDraft";

const product: SalesProduct = {
  id: "product-1",
  itemName: "Paracetamol",
  brandName: "Example",
  manufacturerName: "GPO",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "8850000000001",
  category: "Pain Relief",
  dosageForm: "Tablet",
  imageUrl: "/old.png",
  weeklySold: 0,
  batches: [{
    batchNo: "LOT-1",
    expiryDate: "2028-01-01",
    sellPriceThb: 45,
    availableStock: 8,
  }],
};

function fakeAdapter(overrides: Partial<ProductEditorAdapter> = {}) {
  const events: string[] = [];
  const adapter: ProductEditorAdapter = {
    load: async (productId) => {
      events.push(`load:${productId}`);
      return product;
    },
    save: async (item) => {
      events.push(`save:${item.itemName}`);
      return { ...product, itemName: item.itemName };
    },
    savePhotoUrl: async (productId, photoUrl) => {
      events.push(`photo-url:${productId}:${photoUrl}`);
      return { productId, imageUrl: photoUrl };
    },
    uploadPhoto: async (productId) => {
      events.push(`upload:${productId}`);
      return { productId, imageUrl: "/uploaded.png" };
    },
    delete: async (productId) => {
      events.push(`delete:${productId}`);
    },
    invalidateCache: () => {
      events.push("invalidate");
    },
    ...overrides,
  };
  return { adapter, events };
}

const visibleInventory = (): ProductEditorInventory => ({ products: [product], total: 12 });

test("Product editor sessions open for create, visible, linked, and unavailable Products", async () => {
  const { adapter } = fakeAdapter();
  const lifecycle = createProductEditorLifecycle(adapter);

  assert.deepEqual(lifecycle.openCreate(), { mode: "create", product: null });
  assert.deepEqual(lifecycle.openProduct(product), { mode: "edit", product });
  assert.deepEqual(await lifecycle.openLinked(" product-1 "), {
    kind: "opened",
    session: { mode: "edit", product },
  });

  const missing = createProductEditorLifecycle(fakeAdapter({ load: async () => null }).adapter);
  assert.deepEqual(await missing.openLinked("missing"), {
    kind: "unavailable",
    reason: "missing",
    message: "This Product is no longer available.",
  });

  const failed = createProductEditorLifecycle(fakeAdapter({
    load: async () => { throw new Error("offline"); },
  }).adapter);
  assert.deepEqual(await failed.openLinked("product-1"), {
    kind: "unavailable",
    reason: "load-failed",
    message: "Unable to load this Product.",
  });
});

test("a photo URL-only edit uses the fast write and reconciles the visible Product", async () => {
  const { adapter, events } = fakeAdapter();
  const lifecycle = createProductEditorLifecycle(adapter);
  const item = { ...productToStockItemInput(product), photoUrl: "/new.png" };

  const result = await lifecycle.save({
    session: lifecycle.openProduct(product),
    item,
    inventory: visibleInventory(),
  });

  assert.equal(result.kind, "saved");
  assert.deepEqual(events, ["photo-url:product-1:/new.png", "invalidate"]);
  if (result.kind !== "saved") throw new Error("Product did not save.");
  assert.equal(result.product.imageUrl, "/new.png");
  assert.equal(result.inventory.products[0]?.imageUrl, "/new.png");
  assert.equal(result.refreshInventory, false);
});

test("a full Product save completes before its selected photo upload", async () => {
  const { adapter, events } = fakeAdapter();
  const lifecycle = createProductEditorLifecycle(adapter);
  const photoFile = new File([new Uint8Array([1])], "product.png", { type: "image/png" });

  const result = await lifecycle.save({
    session: lifecycle.openProduct(product),
    item: { ...productToStockItemInput(product), itemName: "Updated Paracetamol" },
    photoFile,
    inventory: visibleInventory(),
  });

  assert.equal(result.kind, "saved");
  assert.deepEqual(events, [
    "save:Updated Paracetamol",
    "upload:product-1",
    "invalidate",
  ]);
  if (result.kind !== "saved") throw new Error("Product did not save.");
  assert.equal(result.product.imageUrl, "/uploaded.png");
  assert.equal(result.inventory.products[0]?.itemName, "Updated Paracetamol");
  assert.equal(result.refreshInventory, true);
});

test("new or deep-linked Products do not bypass the authoritative visible page", async () => {
  const { adapter } = fakeAdapter({
    save: async (item) => ({ ...product, id: "product-2", itemName: item.itemName }),
  });
  const lifecycle = createProductEditorLifecycle(adapter);
  const inventory = visibleInventory();

  const result = await lifecycle.save({
    session: lifecycle.openCreate(),
    item: { ...productToStockItemInput(product), productId: undefined, itemName: "New Product" },
    inventory,
  });

  assert.equal(result.kind, "saved");
  if (result.kind !== "saved") throw new Error("Product did not save.");
  assert.strictEqual(result.inventory, inventory);
  assert.equal(result.refreshInventory, true);
});

test("a photo failure after the Product write invalidates and requests an authoritative reload", async () => {
  const { adapter, events } = fakeAdapter({
    uploadPhoto: async (productId) => {
      events.push(`upload:${productId}`);
      throw new Error("Photo storage is unavailable.");
    },
  });
  const lifecycle = createProductEditorLifecycle(adapter);

  const result = await lifecycle.save({
    session: lifecycle.openProduct(product),
    item: { ...productToStockItemInput(product), itemName: "Saved identity" },
    photoFile: new File([new Uint8Array([1])], "product.png", { type: "image/png" }),
    inventory: visibleInventory(),
  });

  assert.deepEqual(result, {
    kind: "failed",
    message: "Photo storage is unavailable.",
    refreshInventory: true,
  });
  assert.deepEqual(events, ["save:Saved identity", "upload:product-1", "invalidate"]);
});

test("deleting a Product reconciles only a visible authoritative page", async () => {
  const { adapter, events } = fakeAdapter();
  const lifecycle = createProductEditorLifecycle(adapter);
  const session = lifecycle.openProduct(product);

  const visible = await lifecycle.delete({ session, inventory: visibleInventory() });
  assert.equal(visible.kind, "deleted");
  if (visible.kind !== "deleted") throw new Error("Product did not delete.");
  assert.deepEqual(visible.inventory, { products: [], total: 11 });
  assert.deepEqual(events, ["delete:product-1", "invalidate"]);

  const hiddenInventory = { products: [], total: 3 };
  const hidden = await lifecycle.delete({ session, inventory: hiddenInventory });
  assert.equal(hidden.kind, "deleted");
  if (hidden.kind !== "deleted") throw new Error("Product did not delete.");
  assert.strictEqual(hidden.inventory, hiddenInventory);
});

test("write and delete failures remain explicit and preserve the caller page", async () => {
  const lifecycle = createProductEditorLifecycle(fakeAdapter({
    save: async () => { throw new Error("Duplicate barcode."); },
    delete: async () => { throw new Error("Delete conflict."); },
  }).adapter);
  const inventory = visibleInventory();
  const session = lifecycle.openProduct(product);

  assert.deepEqual(await lifecycle.save({
    session,
    item: { ...productToStockItemInput(product), itemName: "Changed" },
    inventory,
  }), {
    kind: "failed",
    message: "Duplicate barcode.",
    refreshInventory: false,
  });
  assert.deepEqual(await lifecycle.delete({ session, inventory }), {
    kind: "failed",
    message: "Delete conflict.",
  });
});
