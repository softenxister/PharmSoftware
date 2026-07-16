import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStockAdjustment,
  isValidDirectStockAdjustmentInput,
} from "./directStockAdjustment";

test("direct stock adjustment accepts unique whole-number batch quantities", () => {
  assert.equal(isValidDirectStockAdjustmentInput({
    productId: "product-1",
    lines: [
      { batchNo: "LOT-1", newQuantity: 8 },
      { batchNo: "LOT-2", newQuantity: 14 },
    ],
  }), true);
});

test("direct stock adjustment rejects unsafe or duplicate batch quantities", () => {
  const base = { productId: "product-1" };
  assert.equal(isValidDirectStockAdjustmentInput({ ...base, lines: [] }), false);
  assert.equal(isValidDirectStockAdjustmentInput({
    ...base,
    lines: [{ batchNo: "LOT-1", newQuantity: -1 }],
  }), false);
  assert.equal(isValidDirectStockAdjustmentInput({
    ...base,
    lines: [{ batchNo: "LOT-1", newQuantity: 1.5 }],
  }), false);
  assert.equal(isValidDirectStockAdjustmentInput({
    ...base,
    lines: [{ batchNo: "LOT-1", newQuantity: Number.POSITIVE_INFINITY }],
  }), false);
  assert.equal(isValidDirectStockAdjustmentInput({
    ...base,
    lines: [
      { batchNo: "LOT-1", newQuantity: 1 },
      { batchNo: " LOT-1 ", newQuantity: 2 },
    ],
  }), false);
  assert.equal(isValidDirectStockAdjustmentInput({
    productId: "",
    lines: [{ batchNo: "LOT-1", newQuantity: 1 }],
  }), false);
});

test("stock adjustment calculation shows each change and final total", () => {
  const result = calculateStockAdjustment([
    { batchNo: "LOT-1", currentQuantity: 10, newQuantity: "8" },
    { batchNo: "LOT-2", currentQuantity: 5, newQuantity: "9" },
  ]);

  assert.equal(result.isValid, true);
  assert.equal(result.hasChanges, true);
  assert.equal(result.currentTotal, 15);
  assert.equal(result.finalTotal, 17);
  assert.equal(result.totalChange, 2);
  assert.deepEqual(result.lines.map((line) => line.change), [-2, 4]);
});

test("stock adjustment calculation blocks blank, decimal, and negative drafts", () => {
  for (const newQuantity of ["", "1.5", "-1", "not-a-number"]) {
    const result = calculateStockAdjustment([
      { batchNo: "LOT-1", currentQuantity: 10, newQuantity },
    ]);
    assert.equal(result.isValid, false, `expected ${newQuantity || "blank"} to be invalid`);
    assert.equal(result.hasChanges, false);
  }
});

test("unchanged whole-number quantities remain valid but cannot be submitted", () => {
  const result = calculateStockAdjustment([
    { batchNo: "LOT-1", currentQuantity: 10, newQuantity: "10" },
  ]);
  assert.equal(result.isValid, true);
  assert.equal(result.hasChanges, false);
  assert.equal(result.totalChange, 0);
});
