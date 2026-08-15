import assert from "node:assert/strict";
import test from "node:test";
import { dashboardHourlySalesSql, dashboardPurchaseTotalSql } from "./dashboardRepository";

test("dashboard hourly sales interpret stored UTC timestamps before converting to Bangkok", () => {
  const query = dashboardHourlySalesSql(
    new Date("2026-08-14T17:00:00.000Z"),
    new Date("2026-08-15T08:00:00.000Z"),
    new Date("2026-08-13T17:00:00.000Z"),
    new Date("2026-08-14T08:00:00.000Z"),
  );

  assert.equal(
    query.text.match(/AT TIME ZONE 'UTC' AT TIME ZONE 'Asia\/Bangkok'/g)?.length,
    2,
  );
});

test("dashboard purchase total includes only received bills in today's period", () => {
  const query = dashboardPurchaseTotalSql(
    new Date("2026-08-14T17:00:00.000Z"),
    new Date("2026-08-15T10:25:00.000Z"),
  );

  assert.match(query.text, /purchase_bill\.status = .*::"PurchaseBillStatus"/);
  assert.match(query.text, /purchase_bill\."purchasedAt" >=/);
  assert.match(query.text, /purchase_bill\."purchasedAt" </);
});
