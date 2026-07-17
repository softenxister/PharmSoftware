import assert from "node:assert/strict";
import test from "node:test";
import type { PharmUser } from "@/server/auth/pharmUser";
import { resolveAuthRoute } from "./authRouting";

const owner: PharmUser = {
  id: "owner-1",
  name: "Store Owner",
  username: "owner",
  phone: "",
  pharmacistLicenseNumber: null,
  avatarUrl: null,
  role: "owner",
  isActive: true,
  mustChangePassword: false,
  canManageStock: true,
};

test("unauthenticated users may only stay on login", () => {
  assert.deepEqual(resolveAuthRoute("/login", null), { redirectTo: null, showAppShell: false });
  assert.deepEqual(resolveAuthRoute("/sales/new", null), { redirectTo: "/login", showAppShell: false });
});

test("temporary-password accounts may only stay on change password", () => {
  const temporaryUser = { ...owner, mustChangePassword: true };
  assert.deepEqual(resolveAuthRoute("/change-password", temporaryUser), { redirectTo: null, showAppShell: false });
  assert.deepEqual(resolveAuthRoute("/", temporaryUser), { redirectTo: "/change-password", showAppShell: false });
  assert.deepEqual(resolveAuthRoute("/login", temporaryUser), { redirectTo: "/change-password", showAppShell: false });
});

test("active accounts leave auth screens and receive the application shell", () => {
  assert.deepEqual(resolveAuthRoute("/login", owner), { redirectTo: "/", showAppShell: false });
  assert.deepEqual(resolveAuthRoute("/change-password", owner), { redirectTo: "/", showAppShell: false });
  assert.deepEqual(resolveAuthRoute("/stock", owner), { redirectTo: null, showAppShell: true });
  assert.deepEqual(resolveAuthRoute("/sales/receipt/sale-1", owner), { redirectTo: null, showAppShell: false });
});
