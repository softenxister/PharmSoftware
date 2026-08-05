import assert from "node:assert/strict";
import test from "node:test";
import {
  latestProductCost,
  markupPercent,
  normalizePurchaseCost,
} from "./stockCost";

test("purchase costs are normalized to the product base unit", () => {
  assert.equal(normalizePurchaseCost(120, 12), 10);
  assert.equal(normalizePurchaseCost(18, 1), 18);
  assert.equal(normalizePurchaseCost(120, 0), undefined);
});

test("product cost uses only the latest purchase observation", () => {
  assert.equal(
    latestProductCost({ costThb: 120, unitMultiplier: 12 }, 18),
    10,
  );
  assert.equal(latestProductCost(undefined, 10), 10);
  assert.equal(latestProductCost(undefined, 0), undefined);
});

test("markup percent uses profit divided by cost", () => {
  assert.equal(markupPercent(45, 30), 50);
  assert.equal(markupPercent(20, 25), -20);
  assert.equal(markupPercent(0, 10), undefined);
  assert.equal(markupPercent(20, undefined), undefined);
});
