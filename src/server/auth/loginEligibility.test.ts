import assert from "node:assert/strict";
import test from "node:test";
import { isAccountLoginEnabled } from "@/app/api/auth/login/route";

test("new pharmacist accounts can sign in before completing their forced password change", () => {
  assert.equal(isAccountLoginEnabled({
    role: "pharmacist",
    isActive: true,
    setupCompletedAt: null,
  }), true);
});

test("an owner cannot sign in until one-time owner setup is complete", () => {
  assert.equal(isAccountLoginEnabled({
    role: "owner",
    isActive: true,
    setupCompletedAt: null,
  }), false);
});

test("inactive accounts cannot sign in", () => {
  assert.equal(isAccountLoginEnabled({
    role: "pharmacist",
    isActive: false,
    setupCompletedAt: null,
  }), false);
});
