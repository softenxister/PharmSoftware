import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStockCategoryOptions,
  filterByStockCategories,
  THAI_PHARMACY_CATEGORIES,
} from "./stockCategoryFilter";

test("category options stay broad and include categories already used by stock", () => {
  const options = buildStockCategoryOptions(["Pain Relief", "Special Clinic Item", "pain relief"]);

  assert.ok(THAI_PHARMACY_CATEGORIES.length >= 15);
  assert.ok(THAI_PHARMACY_CATEGORIES.length <= 24);
  assert.equal(options.filter((option) => option.toLowerCase() === "pain relief").length, 1);
  assert.ok(options.includes("Special Clinic Item"));
});

test("applied categories filter stock case-insensitively and allow multiple selections", () => {
  const items = [
    { id: "pain", category: "Pain Relief" },
    { id: "skin", category: "Skin Care & Cosmetics" },
    { id: "cold", category: "Cold, Cough & Allergy" },
  ];

  assert.deepEqual(filterByStockCategories(items, []), items);
  assert.deepEqual(
    filterByStockCategories(items, ["pain relief", "SKIN CARE & COSMETICS"]).map((item) => item.id),
    ["pain", "skin"],
  );
});
