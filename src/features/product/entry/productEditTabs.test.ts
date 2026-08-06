import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_EDIT_TABS,
  getAdjacentProductEditTab,
} from "./productEditTabs";

test("edit item exposes exactly the four confirmed tabs", () => {
  assert.deepEqual(PRODUCT_EDIT_TABS, [
    "general",
    "pricing-stock",
    "ingredients",
    "packaging",
  ]);
});

test("edit item tab navigation wraps in both directions", () => {
  assert.equal(getAdjacentProductEditTab("general", 1), "pricing-stock");
  assert.equal(getAdjacentProductEditTab("packaging", 1), "general");
  assert.equal(getAdjacentProductEditTab("general", -1), "packaging");
});
