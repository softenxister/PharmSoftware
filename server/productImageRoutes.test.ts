import assert from "node:assert/strict";
import test from "node:test";
import { createServerApp } from "./app";

test("product image review and job routes require an Owner session", async () => {
  const app = createServerApp();
  for (const [method, path] of [
    ["GET", "/api/product-image-review"],
    ["POST", "/api/product-image-review/candidate-1/approve"],
    ["POST", "/api/product-image-review/candidate-1/reject"],
    ["GET", "/api/product-image-jobs/brave"],
    ["POST", "/api/product-image-jobs/brave"],
    ["POST", "/api/product-image-jobs/run"],
    ["GET", "/api/product-image-candidates/candidate-1/preview"],
  ]) {
    const response = await app.request(path, {
      method,
      ...(method === "POST" ? {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Not the correct pack", batchSize: 1 }),
      } : {}),
    });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test("product image delivery requires an authenticated pharmacy account", async () => {
  const app = createServerApp();
  const response = await app.request("/api/product-images/product-1");
  assert.equal(response.status, 401);
});
