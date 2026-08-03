import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePurchaseLineActualCost,
  calculatePurchaseTotals,
  selectPurchaseDiscountType,
} from "./purchaseDraft";

test("purchase discount before VAT reduces the taxable subtotal", () => {
  const lines = [
    { qty: "2", cost: "100" },
    { qty: "3", cost: "50" },
  ];

  assert.deepEqual(calculatePurchaseTotals(lines, false, "20", "thb", "beforeVat"), {
    totalQty: 5,
    subtotal: 350,
    discountAmount: 20,
    vatAmount: 23.1,
    netTotal: 353.1,
  });
});

test("purchase discount after VAT uses the VAT-inclusive total", () => {
  const lines = [{ qty: "1", cost: "350" }];

  assert.deepEqual(calculatePurchaseTotals(lines, false, "20", "thb", "afterVat"), {
    totalQty: 1,
    subtotal: 350,
    discountAmount: 20,
    vatAmount: 24.5,
    netTotal: 354.5,
  });
  assert.deepEqual(calculatePurchaseTotals(lines, false, "10", "percent", "afterVat"), {
    totalQty: 1,
    subtotal: 350,
    discountAmount: 37.45,
    vatAmount: 24.5,
    netTotal: 337.05,
  });
});

test("VAT-inclusive purchases subtract the discount without adding VAT", () => {
  const lines = [{ qty: "2", cost: "100" }];

  assert.deepEqual(calculatePurchaseTotals(lines, true, "10", "percent", "beforeVat"), {
    totalQty: 2,
    subtotal: 200,
    discountAmount: 20,
    vatAmount: 0,
    netTotal: 180,
  });
});

test("changing purchase discount units preserves the exact keyed value", () => {
  assert.deepEqual(selectPurchaseDiscountType("125.50", "percent"), {
    value: "125.50",
    type: "percent",
  });
  assert.deepEqual(selectPurchaseDiscountType("7.25", "thb"), {
    value: "7.25",
    type: "thb",
  });
});

test("purchase line actual cost adds VAT after allocating a before-VAT Baht discount", () => {
  const preview = calculatePurchaseLineActualCost(
    [],
    { qty: "2", cost: "100" },
    false,
    "20",
    "thb",
    "beforeVat",
  );

  assert.deepEqual(preview, {
    baseCost: 100,
    discountPerUnit: 10,
    vatPerUnit: 6.3,
    actualCost: 96.3,
  });
});

test("purchase line actual cost applies an after-VAT Baht discount to the VAT-inclusive cost", () => {
  const preview = calculatePurchaseLineActualCost(
    [],
    { qty: "2", cost: "100" },
    false,
    "20",
    "thb",
    "afterVat",
  );

  assert.deepEqual(preview, {
    baseCost: 100,
    discountPerUnit: 10,
    vatPerUnit: 7,
    actualCost: 97,
  });
});

test("purchase line actual cost does not add VAT when VAT is included", () => {
  const preview = calculatePurchaseLineActualCost(
    [{ qty: "1", cost: "300" }],
    { qty: "2", cost: "100" },
    true,
    "10",
    "percent",
    "beforeVat",
  );

  assert.deepEqual(preview, {
    baseCost: 100,
    discountPerUnit: 10,
    vatPerUnit: 0,
    actualCost: 90,
  });
});
