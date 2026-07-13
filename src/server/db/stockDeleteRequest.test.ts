import assert from "node:assert/strict";
import test from "node:test";
import { parseStockDeleteRequest } from "./stockDeleteRequest";

test("stock deletion accepts one bounded product id", () => {
  assert.deepEqual(parseStockDeleteRequest({ productId: "  product-1  " }), { productId: "product-1" });
});

test("stock deletion rejects missing or malformed product ids", () => {
  assert.equal(parseStockDeleteRequest(null), null);
  assert.equal(parseStockDeleteRequest({}), null);
  assert.equal(parseStockDeleteRequest({ productId: "" }), null);
  assert.equal(parseStockDeleteRequest({ productId: "x".repeat(129) }), null);
});
