import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerPurchaseHistoryWrite } from "./customerPurchaseHistoryMigrationRepository";

const matchedRow = {
  customerRowNumber: 20,
  rowNumber: 21,
  customerCode: "C-25-15",
  customerName: "ปรัฐฐา วิวัฒน์ภิญญโญ",
  externalProductCode: "P-361",
  sourceItemName: "BETADINE 30CC.",
  unit: "ขวด",
  quantity: 1,
  totalAmount: 80,
  issue: null,
  status: "matched" as const,
  matchedCustomerId: "customer-1",
  matchedCustomerName: "Existing member",
  matchedProductId: "product-361",
  matchedItemName: "Betadine",
};

test("matched preview rows become auditable imported purchase writes", () => {
  const write = buildCustomerPurchaseHistoryWrite(matchedRow, {
    id: "history-1",
    fileName: "Rep_CustBuy_Det.xlsx",
    fileHash: "a".repeat(64),
    reportStartedAt: new Date("2022-01-07T12:00:00.000Z"),
    reportEndedAt: new Date("2026-07-21T12:00:00.000Z"),
    importedBy: "Owner",
  });

  assert.deepEqual(write, {
    id: "history-1",
    customerId: "customer-1",
    productId: "product-361",
    customerCode: "C-25-15",
    externalProductCode: "P-361",
    sourceItemName: "BETADINE 30CC.",
    unit: "ขวด",
    quantity: 1,
    totalAmount: 80,
    reportStartedAt: new Date("2022-01-07T12:00:00.000Z"),
    reportEndedAt: new Date("2026-07-21T12:00:00.000Z"),
    sourceFileName: "Rep_CustBuy_Det.xlsx",
    sourceFileHash: "a".repeat(64),
    sourceRow: 21,
    customerRow: 20,
    importedBy: "Owner",
  });
});

test("unmatched preview rows cannot become database writes", () => {
  assert.throws(() => buildCustomerPurchaseHistoryWrite({
    ...matchedRow,
    status: "unmatched_product",
    matchedProductId: null,
  }, {
    id: "history-2",
    fileName: "report.xlsx",
    fileHash: "b".repeat(64),
    reportStartedAt: null,
    reportEndedAt: null,
    importedBy: "Owner",
  }), /matched customer and product/);
});
