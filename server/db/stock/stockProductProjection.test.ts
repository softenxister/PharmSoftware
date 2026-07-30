import assert from "node:assert/strict";
import test from "node:test";
import { stockBatchIdentityKey } from "./stockProductProjection";

test("stock projection keys normalize blank batches and canonical expiry dates", () => {
  assert.equal(
    stockBatchIdentityKey("product-1", "", "01/08/2027"),
    stockBatchIdentityKey("product-1", null, "2027-08-01"),
  );
});
