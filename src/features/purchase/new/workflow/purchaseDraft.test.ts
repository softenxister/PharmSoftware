import assert from "node:assert/strict";
import test from "node:test";
import { calculatePurchaseTotals } from "./purchaseDraft";

test("purchase totals preserve VAT-inclusive and adjustment behavior", () => {
  const lines = [
    { qty: "2", cost: "100" },
    { qty: "3", cost: "50" },
  ];

  assert.deepEqual(calculatePurchaseTotals(lines, true, "10", "percent"), {
    totalQty: 5,
    subtotal: 350,
    adjustmentAmount: 35,
    vatAmount: 0,
    netTotal: 385,
  });
  assert.equal(calculatePurchaseTotals(lines, false, "20", "thb").netTotal, 394.5);
});
