import assert from "node:assert/strict";
import test from "node:test";
import type { SavedStockItem, SalesProduct } from "./types";
import { mergeStockSeedData, normalizeExpiryDate } from "./stockDataMapper";

const seedProduct: SalesProduct = {
  id: "seed-product",
  itemName: "Seed product",
  brandName: "Seed",
  manufacturerName: "Seed manufacturer",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "111",
  category: "Pain Relief",
  imageUrl: "https://example.com/seed.png",
  weeklySold: 1,
  batches: [{ batchNo: "A", expiryDate: "2027-01-31", sellPriceThb: 10, availableStock: 4 }],
};

const savedItem: SavedStockItem = {
  id: "saved-product",
  photoUrl: "",
  barcode: "111",
  itemName: "Saved product",
  lotNo: "B",
  expiryDate: "30/12/2027",
  location: "B1",
  manufacturer: "Saved manufacturer",
  sellPrice: "20",
  itemCategory: "Pain Relief",
  weightage: "1",
  unit: "tablet",
  brandName: "Saved",
  packagingRows: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("normalizeExpiryDate converts supported values to canonical ISO storage", () => {
  assert.equal(normalizeExpiryDate("2027-01-31"), "2027-01-31");
  assert.equal(normalizeExpiryDate("30/12/2027"), "2027-12-30");
  assert.equal(normalizeExpiryDate("  30/12/2027  "), "2027-12-30");
  assert.equal(normalizeExpiryDate("30-12-27"), "2027-12-30");
});

test("saved stock replaces a seed product with the same barcode", () => {
  const [product] = mergeStockSeedData([seedProduct], [savedItem], []);

  assert.equal(product.id, "saved-product");
  assert.equal(product.itemName, "Saved product");
});

test("stock overrides replace batches without duplicating products", () => {
  const [product] = mergeStockSeedData([seedProduct], [], [{
    productId: "seed-product",
    barcode: "111",
    batches: [{ batchNo: "A", expiryDate: "2027-01-31", sellPriceThb: 12, availableStock: 9 }],
  }]);

  assert.equal(product.batches[0]?.availableStock, 9);
  assert.equal(product.batches[0]?.sellPriceThb, 12);
});
