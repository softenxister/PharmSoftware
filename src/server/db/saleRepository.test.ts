import assert from "node:assert/strict";
import test from "node:test";
import { validateSale, type SaleInput } from "./saleRepository";

function saleInput(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    paymentMethod: "Cash",
    purchaseMethod: "pickup",
    subtotal: 40,
    netPayable: 40,
    customerPaid: 40,
    status: "paid",
    lines: [{
      lineId: "line-1",
      itemId: "p-sara",
      itemName: "Sara Paracetamol",
      packLabel: "10 tabs",
      packMultiplier: 1,
      loc: "A1",
      batch: { batchNo: "SAR25041", exp: "2027-01-31", sellPrice: 40 },
      qty: 1,
    }],
    ...overrides,
  };
}

test("paid sales reject a payment below net payable", () => {
  assert.throws(
    () => validateSale(saleInput({ customerPaid: 39.99 })),
    /must cover the net payable/,
  );
});

test("sales reject lines without a positive quantity", () => {
  const input = saleInput();
  input.lines[0].qty = 0;
  assert.throws(() => validateSale(input), /sale items are invalid/);
});

test("sales reject fractional item quantities", () => {
  const input = saleInput();
  input.lines[0].qty = 1.5;
  assert.throws(() => validateSale(input), /sale items are invalid/);
});

test("pending sales can be saved without customer payment", () => {
  assert.doesNotThrow(() => validateSale(saleInput({ status: "pending", customerPaid: null })));
});
