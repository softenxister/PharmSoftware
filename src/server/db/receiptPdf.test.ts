import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createReceiptSnapshot } from "@/lib/receipt";
import { formatReceiptDateTime, generateReceiptPdf } from "@/server/receipts/receiptPdf";

const snapshot = createReceiptSnapshot({
  saleId: "sale-pdf",
  billNo: "INV-20260717-001",
  soldAt: "2026-07-17T03:30:00.000Z",
  customerName: "Walk-in Customer",
  salespersonName: "เภสัชกร สมชาย",
  paymentMethod: "Cash",
  customerPaid: 250,
  changeDue: 35,
  billDiscountAmount: 5,
  store: {
    storeName: "ร้านยาเพชรสมุทร",
    address: "101 ถนนสุขุมวิท แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260",
    phone: "02-123-4567",
    email: "store@example.com",
    taxId: "0105550000000",
    lineId: "@phetsamut",
    facebookPage: "Phetsamut Pharmacy",
    openingTime: "09:00",
    closingTime: "20:00",
  },
  lines: [
    { position: 0, itemName: "TIFFY DEY 4'S.", quantity: 1, originalUnitPrice: 120, discountPercent: 0 },
    { position: 1, itemName: "OPSARAM ED.5CC. EXTRA LONG PRODUCT NAME", quantity: 2, originalUnitPrice: 50, discountPercent: 10 },
  ],
});

test("receipt date and time use Bangkok time with Gregorian Arabic numerals", () => {
  assert.equal(formatReceiptDateTime(snapshot.soldAt), "17/07/2026 10:30");
});

test("receipt generator creates real PDFs at both thermal paper widths", async () => {
  for (const paper of ["58", "80"] as const) {
    const bytes = await generateReceiptPdf(snapshot, paper);
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1);
    assert.ok(Math.abs(document.getPage(0).getWidth() - Number(paper) * 72 / 25.4) < 0.01);
  }
});

test("long receipts split into pages without dropping item rows", async () => {
  const longSnapshot = createReceiptSnapshot({
    ...snapshot,
    saleId: "sale-long",
    billNo: "INV-LONG-001",
    customerPaid: 12_000,
    changeDue: 0,
    billDiscountAmount: 0,
    lines: Array.from({ length: 100 }, (_, position) => ({
      position,
      itemName: `ITEM ${position + 1} WITH A LONG PRODUCT NAME FOR WRAPPING`,
      quantity: 1,
      originalUnitPrice: 120,
      discountPercent: 0,
    })),
  });
  const document = await PDFDocument.load(await generateReceiptPdf(longSnapshot, "58"));
  assert.ok(document.getPageCount() > 1);
});
