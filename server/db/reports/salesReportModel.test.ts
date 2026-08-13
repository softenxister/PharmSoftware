import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesReport,
  parseSalesReportQuery,
  type SalesReportSourceSale,
} from "./salesReportModel";

const sales: SalesReportSourceSale[] = [
  {
    id: "sale-1",
    billNo: "INV-001",
    soldAt: "2026-08-12T17:30:00.000Z",
    customerName: "Anong",
    paymentMethod: "Cash",
    status: "paid",
    itemSubtotal: 100,
    billDiscountAmount: 10,
    netCollected: 90,
    vatAmount: 5.89,
    lines: [
      {
        productId: "product-a",
        productCode: "P-001",
        itemName: "Product A",
        packLabel: "tablet",
        quantity: 2,
        productSales: 100,
        unitCost: 25,
        costSource: "snapshot",
      },
    ],
  },
  {
    id: "sale-2",
    billNo: "INV-002",
    soldAt: "2026-08-13T04:00:00.000Z",
    customerName: "Walk-in Customer",
    paymentMethod: "Bank transfer",
    status: "paid",
    itemSubtotal: 75,
    billDiscountAmount: 0,
    netCollected: 75,
    vatAmount: 4.91,
    lines: [
      {
        productId: "product-a",
        productCode: "P-001",
        itemName: "Product A",
        packLabel: "tablet",
        quantity: 1,
        productSales: 60,
        unitCost: 25,
        costSource: "snapshot",
      },
      {
        productId: "product-b",
        productCode: "P-002",
        itemName: "Product B",
        packLabel: "bottle",
        quantity: 1,
        productSales: 15,
        unitCost: null,
        costSource: "unavailable",
      },
    ],
  },
  {
    id: "sale-pending",
    billNo: "INV-003",
    soldAt: "2026-08-13T06:00:00.000Z",
    customerName: "Pending",
    paymentMethod: "Cash",
    status: "pending",
    itemSubtotal: 999,
    billDiscountAmount: 0,
    netCollected: 999,
    vatAmount: 65.36,
    lines: [],
  },
];

test("sales report query validates view, dates, and bounded pagination", () => {
  const query = parseSalesReportQuery(new URL(
    "http://pharm.test/api/reports/sales?view=product-profit&from=2026-08-01&to=2026-08-13&page=2&pageSize=25",
  ));
  assert.deepEqual(query, {
    view: "product-profit",
    from: "2026-08-01",
    to: "2026-08-13",
    page: 2,
    pageSize: 25,
  });
  assert.throws(
    () => parseSalesReportQuery(new URL("http://pharm.test/api/reports/sales?view=unknown")),
    /report view/i,
  );
  assert.throws(
    () => parseSalesReportQuery(new URL("http://pharm.test/api/reports/sales?from=2026-08-13&to=2026-08-01")),
    /date range/i,
  );
});

test("daily report groups paid sales by Bangkok calendar day", () => {
  const report = buildSalesReport(sales, {
    view: "daily",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 50,
  }, true);

  assert.equal(report.view, "daily");
  assert.equal(report.pagination.totalItems, 1);
  assert.deepEqual(report.rows[0], {
    type: "daily",
    date: "2026-08-13",
    paidBills: 2,
    itemsSold: 4,
    grossProductValue: 175,
    billDiscount: 10,
    vat: 10.8,
    netCollected: 165,
    cost: null,
    grossDifference: null,
    marginPercent: null,
    hasCompleteCost: false,
  });
  assert.deepEqual(report.costCoverage, { pricedLines: 2, totalLines: 3 });
});

test("bill report never fabricates profit when one line lacks historical cost", () => {
  const report = buildSalesReport(sales, {
    view: "bill-profit",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 50,
  }, true);

  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map((row) => ({
    billNo: row.type === "bill-profit" ? row.billNo : "",
    cost: row.type === "bill-profit" ? row.cost : 0,
    difference: row.type === "bill-profit" ? row.grossDifference : 0,
  })), [
    { billNo: "INV-002", cost: null, difference: null },
    { billNo: "INV-001", cost: 50, difference: 40 },
  ]);
});

test("product reports aggregate the same product and preserve missing cost", () => {
  const salesReport = buildSalesReport(sales, {
    view: "product-sales",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 50,
  }, true);
  assert.deepEqual(salesReport.rows.map((row) => ({
    product: row.type === "product-sales" ? row.productName : "",
    quantity: row.type === "product-sales" ? row.quantitySold : 0,
    value: row.type === "product-sales" ? row.productSales : 0,
  })), [
    { product: "Product A", quantity: 3, value: 160 },
    { product: "Product B", quantity: 1, value: 15 },
  ]);

  const profitReport = buildSalesReport(sales, {
    view: "product-profit",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 50,
  }, true);
  assert.deepEqual(profitReport.rows.map((row) => ({
    product: row.type === "product-profit" ? row.productName : "",
    cost: row.type === "product-profit" ? row.cost : 0,
    difference: row.type === "product-profit" ? row.grossDifference : 0,
  })), [
    { product: "Product A", cost: 75, difference: 85 },
    { product: "Product B", cost: null, difference: null },
  ]);
});

test("profit report rejects users without financial access", () => {
  assert.throws(() => buildSalesReport(sales, {
    view: "bill-profit",
    from: "2026-08-13",
    to: "2026-08-13",
    page: 1,
    pageSize: 50,
  }, false), /permission/i);
});
