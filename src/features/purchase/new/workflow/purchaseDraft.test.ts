import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPurchaseLineChange,
  calculatePurchaseLineActualCost,
  calculatePurchaseTotals,
  getPurchaseLineEditorDraft,
  getPurchaseLineEnterAction,
  getPurchaseUnitDisplayValue,
  isPurchaseLineRowActivationKey,
  selectPurchaseDiscountType,
} from "./purchaseDraft";
import type { PurchaseLine } from "./purchaseDraft";

const existingLine: PurchaseLine = {
  id: "line-1",
  productId: "product-1",
  barcode: "8850000000001",
  imageUrl: "/product.png",
  itemName: "Paracetamol 500 mg",
  unit: "Box[10]",
  unitMultiplier: 10,
  qty: "4",
  cost: "125.50",
  freeQty: "1",
  freeUnit: "Box[10]",
  freeUnitMultiplier: 10,
  lotNo: "LOT-2026",
  expiryDate: "31-12-27",
};

test("an added purchase line reopens with its saved editor values", () => {
  assert.deepEqual(getPurchaseLineEditorDraft(existingLine), {
    unit: "Box[10]",
    lineQty: "4",
    lineCost: "125.50",
    includeFreeQty: true,
    freeQty: "1",
    freeUnit: "Box[10]",
    lotNo: "LOT-2026",
    expiryDate: "31-12-27",
  });
});

test("updating an added purchase line replaces it without adding a duplicate", () => {
  const updatedLine = {
    ...existingLine,
    id: "temporary-id",
    qty: "6",
    cost: "120",
    lotNo: "LOT-UPDATED",
  };

  assert.deepEqual(
    applyPurchaseLineChange([existingLine], updatedLine, existingLine.id),
    [{ ...updatedLine, id: existingLine.id }],
  );
});

test("new purchase lines still append to the bill", () => {
  const newLine = { ...existingLine, id: "line-2", productId: "product-2" };

  assert.deepEqual(
    applyPurchaseLineChange([existingLine], newLine, null),
    [existingLine, newLine],
  );
});

test("editable purchase rows activate from Enter or Space only", () => {
  assert.equal(isPurchaseLineRowActivationKey("Enter"), true);
  assert.equal(isPurchaseLineRowActivationKey(" "), true);
  assert.equal(isPurchaseLineRowActivationKey("Escape"), false);
});

test("Enter submits a purchase line from expiry while other fields continue the flow", () => {
  assert.equal(getPurchaseLineEnterAction("Enter", "expiry"), "submit");
  assert.equal(getPurchaseLineEnterAction("Enter", "cost"), "advance");
  assert.equal(getPurchaseLineEnterAction("Tab", "expiry"), "ignore");
});

test("purchase quantity display hides the multiplier for base units only", () => {
  assert.equal(getPurchaseUnitDisplayValue("Tube[1]"), "Tube");
  assert.equal(getPurchaseUnitDisplayValue("Box[10]"), "Box[10]");
  assert.equal(getPurchaseUnitDisplayValue("Bottle"), "Bottle");
});

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
