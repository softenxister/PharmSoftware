import assert from "node:assert/strict";
import test from "node:test";
import { recentSalesWeekRange } from "./weeklySales";

test("weekly product ranking keeps the most recent active sales week after a quiet period", () => {
  assert.deepEqual(
    recentSalesWeekRange(
      new Date("2026-07-27T06:40:28.176Z"),
      new Date("2026-08-04T05:00:00.000Z"),
    ),
    {
      start: new Date("2026-07-20T06:40:28.176Z"),
      end: new Date("2026-07-27T06:40:28.176Z"),
    },
  );
});

test("weekly product ranking uses the current trailing week before any paid sale exists", () => {
  assert.deepEqual(
    recentSalesWeekRange(null, new Date("2026-08-04T05:00:00.000Z")),
    {
      start: new Date("2026-07-28T05:00:00.000Z"),
      end: new Date("2026-08-04T05:00:00.000Z"),
    },
  );
});
