import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesYAxis } from "./dashboardChart";

test("sales chart uses a fixed 3,000 baht maximum with 500 baht gridline intervals", () => {
  assert.deepEqual(buildSalesYAxis(), {
    domain: [0, 3000],
    ticks: [0, 500, 1000, 1500, 2000, 2500, 3000],
  });
});
