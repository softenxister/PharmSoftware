import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeSaleLines,
  validateSale,
  type SaleInput,
} from "./saleRepository";

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

test("sales accept stock stored in a blank batch", () => {
  const input = saleInput();
  input.lines[0].batch = { batchNo: "", exp: "", sellPrice: 40 };
  assert.doesNotThrow(() => validateSale(input));
});

test("batch-split sale lines count and print as one logical item", () => {
  const input = saleInput();
  input.lines = [
    {
      ...input.lines[0],
      lineId: "line-dated",
      qty: 3,
      batch: { batchNo: "S685075", exp: "2029-10-09", sellPrice: 40 },
    },
    {
      ...input.lines[0],
      lineId: "line-blank",
      qty: 10,
      batch: { batchNo: "", exp: "", sellPrice: 40 },
    },
  ];

  assert.deepEqual(summarizeSaleLines(input.lines), {
    itemCount: 1,
    receiptLines: [{
      itemId: "p-sara",
      itemName: "Sara Paracetamol",
      quantity: 13,
      unitPrice: 40,
    }],
  });
});

test("sales accept an independent parent-unit price", () => {
  const input = saleInput();
  input.lines[0].packMultiplier = 20;
  input.lines[0].unitPrice = 95;
  assert.doesNotThrow(() => validateSale(input));
});

test("sales reject an invalid independent parent-unit price", () => {
  const input = saleInput();
  input.lines[0].unitPrice = -1;
  assert.throws(() => validateSale(input), /sale items are invalid/);
});
