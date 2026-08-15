import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardPeriod,
  buildHourlySales,
  buildTimelineHours,
  comparisonPercent,
  summarizeDashboardSales,
} from "./dashboardModel";

test("dashboard period uses the Bangkok day and compares the same elapsed time yesterday", () => {
  const period = buildDashboardPeriod(new Date("2026-08-15T10:25:00.000Z"));

  assert.equal(period.date, "2026-08-15");
  assert.equal(period.todayStart.toISOString(), "2026-08-14T17:00:00.000Z");
  assert.equal(period.todayEnd.toISOString(), "2026-08-15T10:25:00.000Z");
  assert.equal(period.yesterdayStart.toISOString(), "2026-08-13T17:00:00.000Z");
  assert.equal(period.yesterdayEnd.toISOString(), "2026-08-14T10:25:00.000Z");
});

test("store profile hours produce a complete timeline through 22:00", () => {
  assert.deepEqual(buildTimelineHours("08:00", "22:00"), [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00",
  ]);
});

test("invalid or overnight store hours use the safe daytime fallback", () => {
  assert.deepEqual(buildTimelineHours("", ""), [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  ]);
  assert.deepEqual(buildTimelineHours("22:00", "06:00"), buildTimelineHours("", ""));
});

test("dashboard sales summary includes only the supplied paid-sale records", () => {
  const summary = summarizeDashboardSales([
    { netTotal: 120, isMember: true },
    { netTotal: 80, isMember: false },
  ]);

  assert.deepEqual(summary, {
    netSales: 200,
    paidBills: 2,
    memberBills: 1,
    averageBill: 100,
  });
  assert.deepEqual(summarizeDashboardSales([]), {
    netSales: 0,
    paidBills: 0,
    memberBills: 0,
    averageBill: null,
  });
});

test("dashboard comparison avoids fabricated percentages for a zero baseline", () => {
  assert.equal(comparisonPercent(125, 100), 25);
  assert.equal(comparisonPercent(50, 0), null);
  assert.equal(comparisonPercent(0, 0), null);
});

test("hourly chart fills store hours and leaves future current-day points empty", () => {
  const points = buildHourlySales(
    ["20:00", "21:00", "22:00"],
    [{ hour: 20, total: 250 }],
    [{ hour: 20, total: 200 }, { hour: 21, total: 175 }],
    20,
  );

  assert.deepEqual(points, [
    { hour: "20:00", today: 250, yesterday: 200 },
    { hour: "21:00", today: null, yesterday: 175 },
    { hour: "22:00", today: null, yesterday: 0 },
  ]);
});
