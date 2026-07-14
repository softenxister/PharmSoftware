import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageStaff,
  canManageStoreSettings,
  toPharmUser,
} from "./pharmUser";

const accountRecord = {
  id: "account-1",
  name: "Anong S.",
  username: "owner",
  phone: "081-234-5678",
  pharmacistLicenseNumber: null,
  avatarUrl: null,
  role: "owner" as const,
  isActive: true,
  mustChangePassword: false,
};

test("public pharmacy user omits credential fields and owner receives owner permissions", () => {
  const user = toPharmUser({
    ...accountRecord,
    passwordHash: "secret-hash",
  });

  assert.deepEqual(user, {
    ...accountRecord,
    canManageStock: true,
  });
  assert.equal("passwordHash" in user, false);
  assert.equal(canManageStaff(user), true);
  assert.equal(canManageStoreSettings(user), true);
});

test("pharmacist cannot manage staff, store setup, or direct stock adjustment", () => {
  const pharmacist = toPharmUser({
    ...accountRecord,
    id: "account-2",
    username: "pharmacist",
    role: "pharmacist",
    pharmacistLicenseNumber: "PH-101",
    passwordHash: "secret-hash",
  });

  assert.equal(pharmacist.canManageStock, false);
  assert.equal(canManageStaff(pharmacist), false);
  assert.equal(canManageStoreSettings(pharmacist), false);
});
