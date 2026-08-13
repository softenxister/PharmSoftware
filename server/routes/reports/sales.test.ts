import assert from "node:assert/strict";
import test from "node:test";
import type { SalesReportResponse } from "@server/db/reports/salesReportModel";
import { createSalesReportResponse } from "./sales";

const report: SalesReportResponse = {
  view: "daily",
  period: { from: "2026-08-01", to: "2026-08-13" },
  canViewProfit: true,
  taxBasis: "inclusive-7",
  metrics: [],
  rows: [],
  costCoverage: { pricedLines: 0, totalLines: 0 },
  pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 },
};

test("sales report route returns JSON for the standard report request", async () => {
  const response = createSalesReportResponse(report, null);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await response.json(), report);
});

test("sales report route returns an attachment for CSV export", async () => {
  const response = createSalesReportResponse(report, "csv");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="sales-daily-2026-08-01-2026-08-13.csv"',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  assert.match(new TextDecoder().decode(bytes.slice(3)), /^Date,/);
});

test("sales report route returns a PDF attachment with the selected report filename", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const response = createSalesReportResponse(report, "pdf", pdf);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="sales-daily-2026-08-01-2026-08-13.pdf"',
  );
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), pdf);
});
