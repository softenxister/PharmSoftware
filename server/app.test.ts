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
