import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POS_PREFERENCES,
  createPosPreferencesStorageKey,
  getSalesLandingHref,
  loadPosPreferences,
  requiresPosConfirmation,
  savePosPreferences,
  type PosPreferences,
} from "./posPreferences";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("POS preferences use conservative defaults", () => {
  assert.deepEqual(DEFAULT_POS_PREFERENCES, {
    showAvailableStock: false,
    showKeyboardHints: false,
    confirmDestructiveActions: false,
    defaultSalesLanding: "new-sale",
  });
});

test("POS preferences are stored separately for each account", () => {
  const storage = new MemoryStorage();
  const owner = { name: "Anong Owner", role: "owner" } as const;
  const pharmacist = { name: "Nattaya Staff", role: "staff" } as const;
  const ownerPreferences: PosPreferences = {
    ...DEFAULT_POS_PREFERENCES,
    showAvailableStock: true,
    defaultSalesLanding: "sales-history",
  };

  savePosPreferences(storage, owner, ownerPreferences);

  assert.deepEqual(loadPosPreferences(storage, owner), ownerPreferences);
  assert.deepEqual(loadPosPreferences(storage, pharmacist), DEFAULT_POS_PREFERENCES);
  assert.notEqual(
    createPosPreferencesStorageKey(owner),
    createPosPreferencesStorageKey(pharmacist),
  );
});

test("invalid saved values fall back to safe defaults", () => {
  const storage = new MemoryStorage();
  const account = { name: "Nattaya Staff", role: "staff" } as const;
  storage.setItem(
    createPosPreferencesStorageKey(account),
    JSON.stringify({
      showAvailableStock: true,
      defaultSalesLanding: "unknown",
    }),
  );

  assert.deepEqual(loadPosPreferences(storage, account), {
    ...DEFAULT_POS_PREFERENCES,
    showAvailableStock: true,
  });
});

test("sales landing choices map to their real sales destinations", () => {
  assert.equal(getSalesLandingHref("new-sale"), "/sales/new");
  assert.equal(getSalesLandingHref("sales-history"), "/sales");
  assert.equal(getSalesLandingHref("pending-payments"), "/sales?status=pending");
});

test("destructive POS actions only require confirmation when enabled and relevant", () => {
  assert.equal(requiresPosConfirmation(DEFAULT_POS_PREFERENCES, "remove-item", true), false);
  assert.equal(requiresPosConfirmation(DEFAULT_POS_PREFERENCES, "cancel-sale", true), false);

  const confirmingPreferences: PosPreferences = {
    ...DEFAULT_POS_PREFERENCES,
    confirmDestructiveActions: true,
  };
  assert.equal(requiresPosConfirmation(confirmingPreferences, "remove-item", true), true);
  assert.equal(requiresPosConfirmation(confirmingPreferences, "cancel-sale", true), true);
  assert.equal(requiresPosConfirmation(confirmingPreferences, "cancel-sale", false), false);
});
