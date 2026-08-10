import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMON_DOSAGE_TYPES,
  EXPIRY_WINDOWS,
  STOCK_LEVELS,
} from "./inventory/stockInventoryModel";
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
  ];

  for (const option of standardOptions) {
    assert.match(getStockFilterOptionLabel("th", option), /[\u0E00-\u0E7F]/, option);
    assert.equal(getStockFilterOptionLabel("en", option), option);
  }
});

test("stored unit filters translate in both directions", () => {
  assert.equal(getStockFilterOptionLabel("th", "box"), "กล่อง");
  assert.equal(getStockFilterOptionLabel("en", "กล่อง"), "box");
  assert.equal(getStockFilterOptionLabel("en", "อัน"), "piece");
});

test("unknown cross-language unit filters fail closed", () => {
  assert.equal(getStockFilterOptionLabel("th", "Special dosage"), "หน่วย");
  assert.equal(getStockFilterOptionLabel("en", "หน่วยใหม่"), "unit");
});
