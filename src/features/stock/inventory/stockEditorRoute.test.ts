import assert from "node:assert/strict";
import test from "node:test";
import {
  stockEditorHref,
  stockEditorProductId,
  withStockEditorProductId,
} from "./stockEditorRoute";

test("stock editor links carry the unique product id", () => {
  assert.equal(stockEditorHref("product/one"), "/stock?edit=product%2Fone");
  assert.equal(stockEditorProductId(new URLSearchParams("edit=product-1")), "product-1");
});

test("stock editor query state preserves other parameters and clears on close", () => {
  const opened = withStockEditorProductId(new URLSearchParams("page=2"), "product-1");
  assert.equal(opened.toString(), "page=2&edit=product-1");
  assert.equal(withStockEditorProductId(opened, null).toString(), "page=2");
});
