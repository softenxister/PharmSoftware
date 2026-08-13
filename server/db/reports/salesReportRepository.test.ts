import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptSnapshot } from "@/lib/receipt";
import { mapSaleToReportSource } from "./salesReportRepository";

test("legacy receipt lines use historical cost available in the database", () => {
  const receiptSnapshot = createReceiptSnapshot({
    saleId: "sale-legacy",
    billNo: "INV-LEGACY",
    soldAt: "2026-08-04T10:00:00.000Z",
    customerName: "Walk-in Customer",
    salespersonName: "Owner",
    paymentMethod: "Cash",
    customerPaid: 50,
    changeDue: 0,
    billDiscountAmount: 0,
    store: {
      storeName: "Pharmacy",
      address: "Bangkok",
      phone: "020000000",
      taxId: "1234567890123",
      email: "store@example.com",
      lineId: "@pharmacy",
      facebookPage: "Pharmacy",
      openingTime: "08:00",
      closingTime: "20:00",
    },
    lines: [{
      position: 0,
      productId: "product-a",
      packLabel: "10 tablets",
      itemName: "Drug A",
      quantity: 1,
      originalUnitPrice: 50,
      discountPercent: 0,
    }],
  });
  const sale = {
    id: "sale-legacy",
    billNo: "INV-LEGACY",
    soldAt: new Date("2026-08-04T10:00:00.000Z"),
    customerName: "Walk-in Customer",
    paymentMethod: "Cash",
    netTotal: 50,
    discountType: null,
    discountValue: null,
    receiptSnapshot,
    lines: [{
      id: "line-a",
      productId: "product-a",
      itemName: "Drug A",
      packLabel: "10 tablets",
      packMultiplier: 10,
      sellPriceThb: 5,
      unitPriceThb: 50,
      quantity: 1,
      position: 0,
      product: { externalProductCode: "P-001" },
    }],
  } as unknown as Parameters<typeof mapSaleToReportSource>[0];

  const mapped = mapSaleToReportSource(sale, new Map([
    ["line-a", { unitCost: 25 }],
  ]));

  assert.equal(mapped.lines[0].unitCost, 25);
  assert.equal(mapped.lines[0].costSource, "historical-database");
});
