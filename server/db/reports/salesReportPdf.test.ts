import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { StoreProfile } from "@/config/preferences/storeProfile";
import type { DailySalesReportRow, SalesReportResponse } from "@server/db/reports/salesReportModel";
import { generateSalesReportPdf, paginateSalesReportRows } from "./salesReportPdf";

const profile: StoreProfile = {
  storeName: "Phetsamut Pharma",
  address: "50/524 หมู่ 2 ถนนหนามแดง ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540",
  phone: "0963733450",
  email: "",
  taxId: "0115568004551",
  pharmacyLicense: "",
  lineId: "",
  facebookPage: "",
  openingTime: "",
  closingTime: "",
  imageUrl: null,
};

const dailyRow: DailySalesReportRow = {
  type: "daily",
  date: "2026-08-13",
  paidBills: 48,
  itemsSold: 92,
  grossProductValue: 28940,
  billDiscount: 840,
  vat: 1838.32,
  netCollected: 28100,
  cost: 17640,
  grossDifference: 10460,
  marginPercent: 37.22,
  hasCompleteCost: true,
};

const report: SalesReportResponse = {
  view: "daily",
  period: { from: "2026-08-09", to: "2026-08-13" },
  canViewProfit: true,
  taxBasis: "inclusive-7",
  metrics: [{ key: "netCollected", value: 128450.75, format: "money" }],
  rows: [dailyRow],
  costCoverage: { pricedLines: 1, totalLines: 1 },
  pagination: { page: 1, pageSize: 10000, totalItems: 1, totalPages: 1 },
};

test("sales report PDF uses A4 landscape and contains a real PDF document", async () => {
  const bytes = await generateSalesReportPdf(report, profile, new Date("2026-08-13T10:30:00.000Z"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");

  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  const page = document.getPage(0);
  assert.ok(page.getWidth() > page.getHeight());
  assert.ok(Math.abs(page.getWidth() - 841.89) < 0.1);
});

test("sales report PDF paginates long report tables", async () => {
  const longReport: SalesReportResponse = {
    ...report,
    rows: Array.from({ length: 80 }, (_, index) => ({
      ...dailyRow,
      date: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
    })),
    pagination: { page: 1, pageSize: 10000, totalItems: 80, totalPages: 1 },
  };
  const document = await PDFDocument.load(await generateSalesReportPdf(longReport, profile));
  assert.ok(document.getPageCount() > 1);
});

test("report rows fill the printable area without crossing the bottom document margin", () => {
  const rows = Array.from({ length: 40 }, () => dailyRow);
  assert.deepEqual(paginateSalesReportRows(rows).map((pageRows) => pageRows.length), [14, 26]);
});

test("a row that cannot fit completely moves intact to the next page", () => {
  const rows = Array.from({ length: 41 }, () => dailyRow);
  assert.deepEqual(paginateSalesReportRows(rows).map((pageRows) => pageRows.length), [14, 26, 1]);
});
