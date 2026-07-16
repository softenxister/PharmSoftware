import assert from "node:assert/strict";
import test from "node:test";
import { apiRoutes } from "./apiRegistry";

test("the Node server registers every migrated API method and path once", () => {
  const registered = apiRoutes.map(({ method, path }) => `${method} ${path}`);
  assert.equal(new Set(registered).size, registered.length);
  assert.deepEqual(registered, [
    "GET /api/account",
    "PATCH /api/account",
    "POST /api/auth/change-password",
    "POST /api/auth/login",
    "POST /api/auth/logout",
    "GET /api/auth/setup-owner",
    "POST /api/auth/setup-owner",
    "GET /api/current-user",
    "GET /api/ingredients",
    "GET /api/members",
    "POST /api/members",
    "PATCH /api/members",
    "GET /api/preferences",
    "PATCH /api/preferences",
    "GET /api/distributors",
    "GET /api/purchase-corrections",
    "POST /api/purchase-corrections",
    "PATCH /api/purchase-corrections",
    "GET /api/purchase",
    "POST /api/purchase",
    "PUT /api/purchase",
    "GET /api/sales",
    "POST /api/sales",
    "GET /api/staff",
    "POST /api/staff",
    "PATCH /api/staff",
    "POST /api/stock-adjustments",
    "POST /api/stock/batch-adjustments",
    "GET /api/stock",
    "POST /api/stock",
    "DELETE /api/stock",
    "GET /api/store-pos-settings",
    "PATCH /api/store-pos-settings",
  ]);
});
