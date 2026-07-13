import assert from "node:assert/strict";
import test from "node:test";
import {
  filterStockInventoryItems,
  parseStockRange,
  type StockInventoryFilterItem,
} from "./stockInventoryFilters";

const items: StockInventoryFilterItem[] = [
  {
    category: "Pain Relief",
    dosageType: "tablet",
    expiryDates: ["2026-07-20"],
    manufacturer: "GPO",
    min: 10,
    max: 50,
    stock: 6,
  },
  {
    category: "Skin Care & Cosmetics",
    dosageType: "cream",
    expiryDates: ["2027-12-31"],
    manufacturer: "Thai Pharma",
    min: 5,
    max: 30,
    stock: 38,
  },
];

test("inventory filters combine dosage, manufacturer, expiry, stock state, and range", () => {
  const filtered = filterStockInventoryItems(
    items,
    {
      categories: [],
      dosageTypes: ["TABLET"],
      expiryWindows: ["Within 30 days"],
      manufacturers: ["gpo"],
      stockLevels: ["Low Stock"],
      stockRange: { min: 5, max: 10 },
    },
    new Date("2026-07-13T12:00:00+07:00"),
  );

  assert.deepEqual(filtered, [items[0]]);
});

test("stock range parsing accepts optional valid bounds and rejects invalid ranges", () => {
  assert.deepEqual(parseStockRange("", ""), { range: null, isValid: true });
  assert.deepEqual(parseStockRange("5", "20"), { range: { min: 5, max: 20 }, isValid: true });
  assert.equal(parseStockRange("20", "5").isValid, false);
  assert.equal(parseStockRange("-1", "5").isValid, false);
  assert.equal(parseStockRange("five", "10").isValid, false);
});
