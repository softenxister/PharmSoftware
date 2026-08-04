import assert from "node:assert/strict";
import test from "node:test";
import { createServerApp } from "./app";

test("product image delivery requires an authenticated pharmacy account", async () => {
  const app = createServerApp();
  const response = await app.request("/api/product-images/product-1");
  assert.equal(response.status, 401);
});

test("product image upload requires an authenticated pharmacy account", async () => {
  const app = createServerApp();
  const response = await app.request("/api/stock/photos/product-1", {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: new Uint8Array([1, 2, 3]),
  });
  assert.equal(response.status, 401);
});
