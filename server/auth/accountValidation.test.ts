import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAccountProfileUpdate,
  parsePasswordChangeInput,
  parseLoginInput,
  parseOwnerSetupInput,
  parseStaffActionInput,
  parseStaffCreateInput,
  validateAvatarDataUrl,
} from "./accountValidation";

test("owner setup normalizes identity and requires a strong initial password", () => {
  assert.deepEqual(parseOwnerSetupInput({
    name: "  Anong S.  ",
    username: "  OWNER.Main ",
    phone: "081-234-5678",
    password: "counter-safe-2026",
  }), {
    name: "Anong S.",
    username: "owner.main",
    phone: "081-234-5678",
    password: "counter-safe-2026",
  });
  assert.equal(parseOwnerSetupInput({ name: "A", username: "owner", password: "short" }), null);
  assert.equal(parseOwnerSetupInput({ name: "Owner", username: "bad username", password: "counter-safe-2026" }), null);
});

test("login accepts only bounded username and password strings", () => {
  assert.deepEqual(parseLoginInput({ username: "  PHARM.ONE ", password: "temporary-pass" }), {
    username: "pharm.one",
    password: "temporary-pass",
  });
  assert.equal(parseLoginInput({ username: "ab", password: "temporary-pass" }), null);
  assert.equal(parseLoginInput({ username: "pharmacist", password: "" }), null);
});

test("staff creation always produces pharmacist profile input", () => {
  assert.deepEqual(parseStaffCreateInput({
    name: "  Ph. Nattaya S. ",
    username: "NATTAYA",
    phone: "+66 81 111 2222",
    pharmacistLicenseNumber: "ภ.12345",
    password: "temporary-123",
    role: "owner",
  }), {
    name: "Ph. Nattaya S.",
    username: "nattaya",
    phone: "+66 81 111 2222",
    pharmacistLicenseNumber: "ภ.12345",
    password: "temporary-123",
  });
});

test("account update allowlists personal fields and never accepts role", () => {
  assert.deepEqual(parseAccountProfileUpdate({
    name: "  Ph. Somchai T. ",
    username: "SOMCHAI",
    phone: "02-111-2222",
    pharmacistLicenseNumber: "PH-5544",
    avatarUrl: null,
    role: "owner",
  }), {
    name: "Ph. Somchai T.",
    username: "somchai",
    phone: "02-111-2222",
    pharmacistLicenseNumber: "PH-5544",
    avatarUrl: null,
  });
});

test("avatar validation accepts small image data and rejects arbitrary or oversized content", () => {
  const pngHeader = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(validateAvatarDataUrl(pngHeader), pngHeader);
  assert.equal(validateAvatarDataUrl("data:text/html;base64,PHNjcmlwdD4="), null);
  assert.equal(validateAvatarDataUrl(`data:image/png;base64,${"A".repeat(700_000)}`), null);
});

test("normal password changes require the current password but forced changes do not", () => {
  assert.deepEqual(parsePasswordChangeInput({
    currentPassword: "temporary-123",
    newPassword: "new-counter-456",
  }, true), {
    currentPassword: "temporary-123",
    newPassword: "new-counter-456",
  });
  assert.equal(parsePasswordChangeInput({ newPassword: "new-counter-456" }, true), null);
  assert.deepEqual(parsePasswordChangeInput({ newPassword: "new-counter-456" }, false), {
    currentPassword: "",
    newPassword: "new-counter-456",
  });
});

test("staff actions are limited to status changes and temporary password resets", () => {
  assert.deepEqual(parseStaffActionInput({
    staffId: "staff-1",
    action: "set-active",
    isActive: false,
  }), {
    staffId: "staff-1",
    action: "set-active",
    isActive: false,
  });
  assert.deepEqual(parseStaffActionInput({
    staffId: "staff-1",
    action: "reset-password",
    password: "temporary-789",
  }), {
    staffId: "staff-1",
    action: "reset-password",
    password: "temporary-789",
  });
  assert.equal(parseStaffActionInput({ staffId: "staff-1", action: "promote-owner" }), null);
});
