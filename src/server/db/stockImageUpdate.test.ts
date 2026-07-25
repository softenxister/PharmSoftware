import assert from "node:assert/strict";
import test from "node:test";
import { stockImageUpdateDecision } from "./stockImageUpdate";

test("a URL-only edit preserves the existing stored asset until replacement succeeds", () => {
  assert.deepEqual(stockImageUpdateDecision({
    productIdentityChanged: false,
    imageUrlChanged: true,
  }), {
    discardImageRecords: false,
    resetImageResolution: true,
  });
});

test("changing product identity discards image evidence that belongs to the old identity", () => {
  assert.deepEqual(stockImageUpdateDecision({
    productIdentityChanged: true,
    imageUrlChanged: false,
  }), {
    discardImageRecords: true,
    resetImageResolution: true,
  });
});

test("an unchanged product does not reset image resolution", () => {
  assert.deepEqual(stockImageUpdateDecision({
    productIdentityChanged: false,
    imageUrlChanged: false,
  }), {
    discardImageRecords: false,
    resetImageResolution: false,
  });
});
