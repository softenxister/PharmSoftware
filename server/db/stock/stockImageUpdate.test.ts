import assert from "node:assert/strict";
import test from "node:test";
import { shouldDiscardStoredProductImage } from "./stockImageUpdate";

test("a URL-only edit preserves the existing stored asset until replacement succeeds", () => {
  assert.equal(shouldDiscardStoredProductImage({
    productIdentityChanged: false,
  }), false);
});

test("changing product identity discards the stored image that belongs to the old identity", () => {
  assert.equal(shouldDiscardStoredProductImage({
    productIdentityChanged: true,
  }), true);
});

test("an unchanged product preserves its stored image", () => {
  assert.equal(shouldDiscardStoredProductImage({
    productIdentityChanged: false,
  }), false);
});
