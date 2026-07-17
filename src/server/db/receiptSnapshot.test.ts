import assert from "node:assert/strict";
import test from "node:test";
import { encodeCode128B } from "@/lib/code128";
import {
  calculateInclusiveVat,
  createLegacyReceiptSnapshot,
  createReceiptSnapshot,
  normalizeReceiptPaperSize,
  parseReceiptSnapshot,
  receiptPaymentMethodLabel,
} from "@/lib/receipt";

const completeStore = {
  storeName: "ร้านยาเพชรสมุทร",
  address: "101 ถนนสุขุมวิท กรุงเทพมหานคร 10260",
  phone: "02-123-4567",
  email: "store@example.com",
  taxId: "0105550000000",
  lineId: "@phetsamut",
  facebookPage: "Phetsamut Pharmacy",
  openingTime: "09:00",
  closingTime: "20:00",
};

test("VAT is extracted from the final VAT-inclusive payable amount", () => {
  assert.deepEqual(calculateInclusiveVat(107), { beforeVat: 100, vatAmount: 7 });
  assert.deepEqual(calculateInclusiveVat(115), { beforeVat: 107.48, vatAmount: 7.52 });
});

test("Code 128B output includes start, checksum, and stop patterns", () => {
  const encoded = encodeCode128B("INV-001");
  assert.equal(encoded[0], "211214");
  assert.equal(encoded.at(-1), "2331112");
  assert.equal(encoded.length, "INV-001".length + 3);
  assert.throws(() => encodeCode128B("เลขที่"), /ASCII/);
});

test("persisted receipt snapshots fail closed when their shape is malformed", () => {
  const valid = createReceiptSnapshot({
    saleId: "sale-1", billNo: "INV-001", soldAt: "2026-07-17T10:30:00.000Z",
    customerName: "Customer", salespersonName: "Owner", paymentMethod: "Cash",
    customerPaid: 107, changeDue: 0, billDiscountAmount: 0, store: completeStore,
    lines: [{ position: 0, itemName: "Drug", quantity: 1, originalUnitPrice: 107, discountPercent: 0 }],
  });
  assert.deepEqual(parseReceiptSnapshot(valid), valid);
  assert.equal(parseReceiptSnapshot({ ...valid, version: 2 }), null);
  assert.equal(parseReceiptSnapshot({ ...valid, lines: [] }), null);
  assert.equal(parseReceiptSnapshot({ ...valid, store: {} }), null);
  assert.equal(parseReceiptSnapshot({ ...valid, netTotal: valid.netTotal + 1 }), null);
});

test("receipt snapshot preserves item order and prints final item prices without item discount rows", () => {
  const snapshot = createReceiptSnapshot({
    saleId: "sale-1",
    billNo: "INV-001",
    soldAt: "2026-07-17T10:30:00.000Z",
    customerName: "Walk-in Customer",
    salespersonName: "เภสัชกร สมชาย",
    paymentMethod: "Cash",
    customerPaid: 250,
    changeDue: 45,
    billDiscountAmount: 5,
    store: completeStore,
    lines: [
      { position: 0, itemName: "TIFFY DEY 4'S.", quantity: 1, originalUnitPrice: 120, discountPercent: 0 },
      { position: 1, itemName: "OPSARAM ED.5CC.", quantity: 2, originalUnitPrice: 50, discountPercent: 10 },
    ],
  });

  assert.deepEqual(snapshot.lines, [
    { position: 0, itemName: "TIFFY DEY 4'S.", quantity: 1, unitPrice: 120, lineTotal: 120 },
    { position: 1, itemName: "OPSARAM ED.5CC.", quantity: 2, unitPrice: 45, lineTotal: 90 },
  ]);
  assert.equal(snapshot.customerName, "ลูกค้าทั่วไป");
  assert.equal(snapshot.itemSubtotal, 210);
  assert.equal(snapshot.billDiscountAmount, 5);
  assert.equal(snapshot.netTotal, 205);
  assert.deepEqual(snapshot.vat, { beforeVat: 191.59, vatAmount: 13.41 });
});

test("receipt snapshot stays equal to the canonical paid total across rounding boundaries", () => {
  const snapshot = createReceiptSnapshot({
    saleId: "sale-rounding", billNo: "INV-ROUND", soldAt: "2026-07-17T10:30:00.000Z",
    customerName: "Customer", salespersonName: "Owner", paymentMethod: "Cash",
    customerPaid: 27.13, changeDue: 0, billDiscountAmount: 0, expectedNetTotal: 27.13,
    store: completeStore,
    lines: [{ position: 0, itemName: "Drug", quantity: 3, originalUnitPrice: 10.05, discountPercent: 10 }],
  });
  assert.equal(snapshot.itemSubtotal, 27.13);
  assert.equal(snapshot.netTotal, 27.13);
  assert.equal(snapshot.lines[0].lineTotal, 27.13);
});

test("receipt snapshot rejects fractional quantities and incomplete store identity", () => {
  const input = {
    saleId: "sale-1",
    billNo: "INV-001",
    soldAt: "2026-07-17T10:30:00.000Z",
    customerName: "Customer",
    salespersonName: "Owner",
    paymentMethod: "Cash",
    customerPaid: 100,
    changeDue: 0,
    billDiscountAmount: 0,
    store: completeStore,
    lines: [{ position: 0, itemName: "Drug", quantity: 1.5, originalUnitPrice: 100, discountPercent: 0 }],
  };
  assert.throws(() => createReceiptSnapshot(input), /whole-number quantities/);
  assert.throws(() => createReceiptSnapshot({ ...input, billNo: "เลขที่", lines: [{ ...input.lines[0], quantity: 1 }] }), /printable ASCII/);
  assert.throws(() => createReceiptSnapshot({
    ...input,
    store: { ...completeStore, taxId: "" },
    lines: [{ ...input.lines[0], quantity: 1 }],
  }), /Store Profile/);
});

test("receipt paper size and payment labels are bounded and translated", () => {
  assert.equal(normalizeReceiptPaperSize("58"), "58");
  assert.equal(normalizeReceiptPaperSize("80"), "80");
  assert.equal(normalizeReceiptPaperSize("A4"), "80");
  assert.equal(receiptPaymentMethodLabel("Cash"), "เงินสด");
  assert.equal(receiptPaymentMethodLabel("Bank transfer"), "โอนเงิน");
  assert.equal(receiptPaymentMethodLabel("Credit card"), "บัตรเครดิต");
  assert.equal(receiptPaymentMethodLabel("Future method"), "Future method");
});

test("legacy receipt reconstruction preserves the saved net and known bill discount", () => {
  const snapshot = createLegacyReceiptSnapshot({
    saleId: "legacy-1",
    billNo: "INV-LEGACY",
    soldAt: "2026-07-17T10:30:00.000Z",
    customerName: "Customer",
    salespersonName: "Owner",
    paymentMethod: "Bank transfer",
    customerPaid: 180,
    changeDue: 0,
    netTotal: 180,
    billDiscount: { type: "percent", value: 10 },
    store: completeStore,
    lines: [
      { position: 0, itemName: "A", quantity: 1, originalUnitPrice: 100 },
      { position: 1, itemName: "B", quantity: 2, originalUnitPrice: 50 },
    ],
  });
  assert.equal(snapshot.itemSubtotal, 200);
  assert.equal(snapshot.billDiscountAmount, 20);
  assert.equal(snapshot.netTotal, 180);
  assert.deepEqual(snapshot.lines.map((line) => line.lineTotal), [100, 100]);
});
