import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomerPurchaseHistoryRows,
  prepareCustomerPurchaseHistoryMigration,
} from "./customerPurchaseHistoryMigration";
import type { XlsxWorksheetRow } from "./xlsxWorksheet";

function row(rowNumber: number, values: Record<string, string>): XlsxWorksheetRow {
  return { rowNumber, values: new Map(Object.entries(values)) };
}

const worksheetRows: XlsxWorksheetRow[] = [
  row(5, { A: "ทุกรายการลูกค้า\nวันที่ 07/01/2022 ถึง 21/07/2026" }),
  row(8, { A: "1", B: ": ไม่ระบุ" }),
  row(9, { C: "P-2: UNKNOWN SALE", G: "กล่อง", H: "21", K: "1287" }),
  row(20, { A: "2", B: "C-25-15: ปรัฐฐา วิวัฒน์ภิญญโญ" }),
  row(21, { C: "P-361: BETADINE 30CC.", G: "ขวด", H: "1", M: "80" }),
  row(22, { C: "P-380: BETNOVATE-N CREAM 15G.", G: "หลอด", H: "2", K: "260" }),
  row(23, { C: "P-400: ZERO VALUE", G: "แผง", H: "0", K: "0" }),
  row(24, { C: "P-361: BETADINE 30CC.", G: "ขวด", H: "2", K: "160" }),
  row(30, { A: "3", B: "C-99-1: Missing customer" }),
  row(31, { C: "P-361: BETADINE 30CC.", G: "ขวด", H: "3", K: "240" }),
];

test("parser ignores unknown-customer rows and extracts customer and product codes", () => {
  const parsed = parseCustomerPurchaseHistoryRows(worksheetRows);

  assert.equal(parsed.rows.length, 5);
  assert.deepEqual(parsed.reportPeriod, {
    startedAt: new Date("2022-01-07T12:00:00.000Z"),
    endedAt: new Date("2026-07-21T12:00:00.000Z"),
  });
  assert.deepEqual(parsed.rows[0], {
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
  });
  assert.equal(parsed.rows[1].totalAmount, 260);
  assert.match(parsed.rows[2].issue ?? "", /greater than zero/i);
});

test("preview matches known codes and reports missing codes, invalid values, and duplicate rows", () => {
  const prepared = prepareCustomerPurchaseHistoryMigration({
    fileName: "Rep_CustBuy_Det.xlsx",
    fileBytes: new TextEncoder().encode("customer purchase report"),
    worksheetRows,
    existingCustomers: [{ id: "customer-1", memberCode: "C-25-15", name: "Existing member" }],
    existingProducts: [
      { id: "product-361", externalProductCode: "P-361", itemName: "Betadine" },
    ],
    duplicateSourceRows: new Set([24]),
  });

  assert.deepEqual(prepared.preview.summary, {
    totalRows: 5,
    matchedCount: 1,
    duplicateCount: 1,
    unmatchedCustomerCount: 1,
    unmatchedProductCount: 1,
    conflictCount: 1,
  });
  assert.deepEqual(
    prepared.preview.rows.map(({ rowNumber, status }) => [rowNumber, status]),
    [
      [23, "conflict"],
      [31, "unmatched_customer"],
      [22, "unmatched_product"],
      [24, "duplicate"],
      [21, "matched"],
    ],
  );
  assert.equal(prepared.preview.rows[4].matchedCustomerId, "customer-1");
  assert.equal(prepared.preview.rows[4].matchedProductId, "product-361");
  assert.match(prepared.preview.rows[1].issue ?? "", /C-99-1/);
});
