import assert from "node:assert/strict";
import test from "node:test";
import { isValidPurchaseBillInput } from "./purchaseValidation";

const validBill = {
  status: "draft",
  totalQty: 2,
  netTotal: 80,
  lines: [{
    id: "line-1",
    productId: "product-1",
    barcode: "8850001000014",
    itemName: "Test medicine",
    unit: "blisterpack",
    unitMultiplier: 1,
    quantity: 2,
    cost: 40,
    freeUnit: "blisterpack",
    freeUnitMultiplier: 1,
    freeQuantity: 0,
    batchNo: "LOT-1",
    expiryDate: "31/12/2027",
  }],
};

test("validates a complete purchase draft payload", () => {
  assert.equal(isValidPurchaseBillInput(validBill), true);
});

test("requires an id when updating a purchase bill", () => {
  assert.equal(isValidPurchaseBillInput(validBill, { requireId: true }), false);
  assert.equal(isValidPurchaseBillInput({ ...validBill, id: "purchase-1" }, { requireId: true }), true);
});

test("rejects an existing bill id from a create payload", () => {
  assert.equal(isValidPurchaseBillInput({ ...validBill, id: "purchase-1" }), false);
});

test("rejects invalid totals, line quantities, and expiry dates", () => {
  assert.equal(isValidPurchaseBillInput({ ...validBill, netTotal: Number.NaN }), false);
  assert.equal(isValidPurchaseBillInput({
    ...validBill,
    lines: [{ ...validBill.lines[0], quantity: 0 }],
  }), false);
  assert.equal(isValidPurchaseBillInput({
    ...validBill,
    lines: [{ ...validBill.lines[0], expiryDate: "31/04/2027" }],
  }), false);
});
