import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  buildFilterOptions,
  parseStockRange,
  projectAuthoritativeInventoryPage,
} from "./stockInventoryModel";

const product: SalesProduct = {
  id: "product-1",
  itemName: "Server-selected product",
  brandName: "Example",
  manufacturerName: "GPO",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "8850000000001",
  category: "Pain Relief",
  imageUrl: "",
  weeklySold: 0,
  minimumStock: 10,
  maximumStock: 50,
  batches: [{
    batchNo: "LOT-1",
    expiryDate: "2027-08-01",
    sellPriceThb: 45,
    availableStock: 8,
  }],
};

test("inventory renders the authoritative server page without filtering it again", () => {
  const page = projectAuthoritativeInventoryPage({
    products: [product],
    page: 3,
    pageSize: 50,
    total: 121,
    hasMore: false,
  });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].name, "Server-selected product");
  assert.equal(page.items[0].state, "low");
  assert.equal(page.page, 3);
  assert.equal(page.total, 121);
  assert.equal(page.hasMore, false);
});

test("inventory option lists stay stable while adding server values", () => {
  assert.deepEqual(
    buildFilterOptions(["Tablet", "Capsule"], ["tablet", "Cream", " GPO "]),
    ["Tablet", "Capsule", "Cream", "GPO"],
  );
});

test("stock range parsing accepts optional bounds and rejects invalid ranges", () => {
  assert.deepEqual(parseStockRange("", ""), { range: null, isValid: true });
  assert.deepEqual(
    parseStockRange("5", "20"),
    { range: { min: 5, max: 20 }, isValid: true },
  );
  assert.equal(parseStockRange("20", "5").isValid, false);
  assert.equal(parseStockRange("-1", "5").isValid, false);
  assert.equal(parseStockRange("five", "10").isValid, false);
});
