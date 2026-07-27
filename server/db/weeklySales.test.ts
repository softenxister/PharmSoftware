import assert from "node:assert/strict";
import test from "node:test";
import { bangkokWeekRange } from "./weeklySales";

test("Bangkok sales week runs from Monday midnight to the next Monday", () => {
  assert.deepEqual(
    bangkokWeekRange(new Date("2026-07-26T16:59:59.999Z")),
    {
      start: new Date("2026-07-19T17:00:00.000Z"),
      end: new Date("2026-07-26T17:00:00.000Z"),
    },
  );

  assert.deepEqual(
    bangkokWeekRange(new Date("2026-07-26T17:00:00.000Z")),
    {
      start: new Date("2026-07-26T17:00:00.000Z"),
      end: new Date("2026-08-02T17:00:00.000Z"),
    },
  );
});
