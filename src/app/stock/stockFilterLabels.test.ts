import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMON_DOSAGE_TYPES,
  EXPIRY_WINDOWS,
  STOCK_ADJUSTMENT_STATES,
  STOCK_LEVELS,
} from "./stockInventoryFilters";
import { getStockFilterOptionLabel } from "./stockFilterLabels";

test("every standard Stock sidebar option has a Thai display label", () => {
  const standardOptions = [
    ...COMMON_DOSAGE_TYPES,
    "tab",
    "caplet",
    "ml",
    "sachet",
    "piece",
    "g",
    ...EXPIRY_WINDOWS,
    ...STOCK_LEVELS,
    ...STOCK_ADJUSTMENT_STATES,
  ];

  for (const option of standardOptions) {
    assert.match(getStockFilterOptionLabel("th", option), /[\u0E00-\u0E7F]/, option);
    assert.equal(getStockFilterOptionLabel("en", option), option);
  }
});

test("unknown stored option values stay unchanged", () => {
  assert.equal(getStockFilterOptionLabel("th", "Special dosage"), "Special dosage");
});
