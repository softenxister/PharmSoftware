import assert from "node:assert/strict";
import test from "node:test";
import { createServerApp } from "./app";

test("product image delivery requires an authenticated pharmacy account", async () => {
  const app = createServerApp();
  const response = await app.request("/api/product-images/product-1");
  assert.equal(response.status, 401);
});
