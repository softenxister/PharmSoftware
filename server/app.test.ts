import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createServerApp } from "./app";

test("production security policy allows generated receipt PDFs in frames", () => {
  const script = `
    const { createServerApp } = await import("./server/app.ts");
    const response = await createServerApp().request("http://pharm.test/sales/receipt/test");
    console.log(response.headers.get("content-security-policy") ?? "");
  `;
  const policy = execFileSync(process.execPath, [
    "--env-file-if-exists=.env",
    "--import",
    "tsx",
    "--eval",
    script,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production" },
  }).trim();

  assert.match(policy, /(?:^|;\s*)frame-src 'self' blob:(?:;|$)/);
  assert.match(policy, /(?:^|;\s*)object-src 'none'(?:;|$)/);
});

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

test("lot and expiry migration accepts multipart-sized bodies up to its 5 MB file limit", async () => {
  const response = await createServerApp().request("http://pharm.test/api/stock/migrations/lots", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: "x".repeat(3 * 1024 * 1024),
  });

  assert.equal(response.status, 401, "the lot route should receive the request instead of the 2 MB middleware rejecting it");
});

test("product photo upload accepts image bodies above the default API limit", async () => {
  const response = await createServerApp().request("http://pharm.test/api/stock/photos/product-1", {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(3 * 1024 * 1024),
  });

  assert.equal(response.status, 401, "the product photo route should receive the request instead of the 2 MB middleware rejecting it");
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
