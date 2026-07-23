import assert from "node:assert/strict";
import test from "node:test";
import { createServerApp } from "./app";

test("unknown API routes stay JSON and are never cached", async () => {
  const response = await createServerApp().request("http://pharm.test/api/not-a-route");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "API route not found." });
});

test("oversized API bodies are rejected before a route handler runs", async () => {
  const response = await createServerApp().request("http://pharm.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "x".repeat(2 * 1024 * 1024) }),
  });

  assert.equal(response.status, 413);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Request body is too large." });
});

test("stock migration accepts multipart-sized bodies up to its 5 MB file limit", async () => {
  const response = await createServerApp().request("http://pharm.test/api/stock/migrations/cw", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: "x".repeat(3 * 1024 * 1024),
  });

  assert.equal(response.status, 401, "the stock route should receive the request instead of the 2 MB middleware rejecting it");
});

test("product measurement normalization rejects unauthenticated database writes", async () => {
  const response = await createServerApp().request(
    "http://pharm.test/api/stock/migrations/measurements",
    { method: "POST" },
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    },
  });
});
