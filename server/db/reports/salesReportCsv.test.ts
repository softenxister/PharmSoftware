import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesReport, type SalesReportSourceSale } from "./salesReportModel";
import { createSalesReportCsv } from "./salesReportCsv";

test("sales report CSV is Excel-compatible and neutralizes spreadsheet formulas", () => {
  const sales: SalesReportSourceSale[] = [{
    id: "sale-1",
    billNo: "INV-001",
    soldAt: "2026-08-13T04:00:00.000Z",
    customerName: "=HYPERLINK(\"https://bad.example\")",
    paymentMethod: "Cash",
    status: "paid",
    itemSubtotal: 100,
    billDiscountAmount: 10,
    netCollected: 90,
    vatAmount: 5.89,
    lines: [{
      productId: "product-a",
      productCode: "P-001",
      itemName: "Drug A",
      packLabel: "tablet",
      quantity: 1,
      productSales: 100,
      unitCost: 40,
      costSource: "snapshot",
    }],
  }];
  const report = buildSalesReport(sales, {
    view: "bill-profit",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 100,
  }, true);

  const csv = createSalesReportCsv(report);
  assert.ok(csv.startsWith("\uFEFFBill number,Date and time,Customer"));
  assert.match(csv, /INV-001/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
  assert.match(csv, /90\.00,40\.00,50\.00/);
});
