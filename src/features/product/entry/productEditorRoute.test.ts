import assert from "node:assert/strict";
import test from "node:test";
import {
  productEditorHref,
  productEditorProductId,
  withProductEditorProductId,
} from "./productEditorRoute";

test("Product editor links carry the unique Product id", () => {
  assert.equal(productEditorHref("product/one"), "/stock?edit=product%2Fone");
  assert.equal(productEditorProductId(new URLSearchParams("edit=product-1")), "product-1");
});

test("Product editor query state preserves other parameters and clears on close", () => {
  const opened = withProductEditorProductId(new URLSearchParams("page=2"), "product-1");
  assert.equal(opened.toString(), "page=2&edit=product-1");
  assert.equal(withProductEditorProductId(opened, null).toString(), "page=2");
});
