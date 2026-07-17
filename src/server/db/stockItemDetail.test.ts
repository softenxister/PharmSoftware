import assert from "node:assert/strict";
import test from "node:test";
import {
  canRoleUpdateStockDiscount,
  hasForbiddenStockDiscountChange,
  parseStockItemDetailPatch,
} from "./stockItemDetail";

const validDetailPatch = {
  productId: "product-1",
  location: "A1-02",
  category: "Pain Relief",
  minimumStock: 20,
  maximumStock: 200,
  isReturnable: true,
  defaultDosage: [1, 0, 1, 0],
  tagName: "Best seller",
  discountPercent: 10,
  isDiscountLocked: true,
};

test("stock item detail patch accepts the approved integer settings", () => {
  assert.deepEqual(parseStockItemDetailPatch(validDetailPatch), validDetailPatch);
});

test("stock item detail patch rejects invalid stock, discount, dosage, and text values", () => {
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, minimumStock: 201 }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, discountPercent: 2.5 }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, discountPercent: 101 }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, defaultDosage: [1, -1, 0, 0] }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, defaultDosage: [1, 0, 0] }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, location: "" }), null);
  assert.equal(parseStockItemDetailPatch({ ...validDetailPatch, tagName: "x".repeat(61) }), null);
});

test("only owners can update item discount policy", () => {
  assert.equal(canRoleUpdateStockDiscount("owner"), true);
  assert.equal(canRoleUpdateStockDiscount("pharmacist"), false);
});

test("pharmacists may submit visible discount values only when they are unchanged", () => {
  const current = { discountPercent: 10, isDiscountLocked: true };
  assert.equal(hasForbiddenStockDiscountChange("pharmacist", current, validDetailPatch), false);
  assert.equal(hasForbiddenStockDiscountChange("pharmacist", current, {
    ...validDetailPatch,
    discountPercent: 11,
  }), true);
  assert.equal(hasForbiddenStockDiscountChange("pharmacist", current, {
    ...validDetailPatch,
    isDiscountLocked: false,
  }), true);
  assert.equal(hasForbiddenStockDiscountChange("owner", current, {
    ...validDetailPatch,
    discountPercent: 11,
  }), false);
});
