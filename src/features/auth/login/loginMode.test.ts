import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_LOGIN_MODE, resolveOwnerSetupMode } from "./loginMode";

test("login renders a usable sign-in form before setup status returns", () => {
  assert.equal(INITIAL_LOGIN_MODE, "login");
});

test("background owner setup status changes mode only when setup is required", () => {
  assert.equal(resolveOwnerSetupMode(true), "setup");
  assert.equal(resolveOwnerSetupMode(false), "login");
});
