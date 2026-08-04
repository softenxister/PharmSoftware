import assert from "node:assert/strict";
import test from "node:test";
import {
  averageProductCost,
  marginPercent,
  normalizePurchaseCost,
} from "./stockCost";

test("purchase costs are normalized to the product base unit", () => {
  assert.equal(normalizePurchaseCost(120, 12), 10);
  assert.equal(normalizePurchaseCost(18, 1), 18);
  assert.equal(normalizePurchaseCost(120, 0), undefined);
});

test("average product cost gives each distributor and migration one observation", () => {
  assert.equal(
    averageProductCost([
      { costThb: 120, unitMultiplier: 12 },
      { costThb: 18, unitMultiplier: 1 },
    ], 10),
    12.67,
  );
  assert.equal(averageProductCost([], 10), 10);
  assert.equal(averageProductCost([], 0), undefined);
});

test("margin percent uses profit divided by sell price", () => {
  assert.equal(marginPercent(45, 30), 33.33);
  assert.equal(marginPercent(20, 25), -25);
  assert.equal(marginPercent(0, 10), undefined);
  assert.equal(marginPercent(20, undefined), undefined);
});
