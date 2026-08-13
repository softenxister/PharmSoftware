import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesReportRequestUrl,
  resolveSalesReportLocation,
  reportSearchParams,
} from "./salesReportModel";
import { reportExportUrl } from "./salesReportClient";

const now = new Date("2026-08-13T05:00:00.000Z");

test("report location uses the saved range when URL filters are absent", () => {
  assert.deepEqual(resolveSalesReportLocation(new URLSearchParams(), "7d", true, now), {
    view: "daily",
    range: "7d",
    from: "2026-08-07",
    to: "2026-08-13",
    page: 1,
  });
});

test("custom dates and page survive URL normalization", () => {
  const resolved = resolveSalesReportLocation(new URLSearchParams(
    "view=product-sales&range=custom&from=2026-07-01&to=2026-07-31&page=3",
  ), "30d", true, now);
  assert.deepEqual(resolved, {
    view: "product-sales",
    range: "custom",
    from: "2026-07-01",
    to: "2026-07-31",
    page: 3,
  });
  assert.equal(reportSearchParams(resolved).toString(),
    "view=product-sales&range=custom&from=2026-07-01&to=2026-07-31&page=3");
});

test("users without profit permission cannot deep-link into profit views", () => {
  assert.equal(resolveSalesReportLocation(
    new URLSearchParams("view=bill-profit"),
    "today",
    false,
    now,
  ).view, "daily");
});

test("report request URL carries only the server contract fields", () => {
  assert.equal(buildSalesReportRequestUrl({
    view: "product-profit",
    range: "30d",
    from: "2026-07-15",
    to: "2026-08-13",
    page: 2,
  }), "/api/reports/sales?view=product-profit&from=2026-07-15&to=2026-08-13&page=2&pageSize=50");
});

test("report export URL preserves the selected filters and requests the chosen file format", () => {
  const location = {
    view: "daily" as const,
    range: "custom" as const,
    from: "2026-08-01",
    to: "2026-08-13",
    page: 3,
  };
  assert.equal(
    reportExportUrl(location, "pdf"),
    "/api/reports/sales?view=daily&from=2026-08-01&to=2026-08-13&page=1&pageSize=50&format=pdf",
  );
  assert.equal(
    reportExportUrl(location, "csv"),
    "/api/reports/sales?view=daily&from=2026-08-01&to=2026-08-13&page=1&pageSize=50&format=csv",
  );
});
