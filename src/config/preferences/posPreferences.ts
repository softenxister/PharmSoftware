export type SalesLanding = "new-sale" | "sales-history" | "pending-payments";

export type PosPreferences = {
  showAvailableStock: boolean;
  showKeyboardHints: boolean;
  confirmDestructiveActions: boolean;
  showPaymentMethodAfterNetTotal: boolean;
  defaultSalesLanding: SalesLanding;
};

export type PosPreferenceAccount = {
  id?: string;
  name: string;
  role: string;
};

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export const POS_PREFERENCES_CHANGED_EVENT = "pharm:pos-preferences-changed";

export const DEFAULT_POS_PREFERENCES: Readonly<PosPreferences> = Object.freeze({
  showAvailableStock: false,
  showKeyboardHints: false,
  confirmDestructiveActions: false,
  showPaymentMethodAfterNetTotal: true,
  defaultSalesLanding: "new-sale",
});

const SALES_LANDINGS = new Set<SalesLanding>([
  "new-sale",
  "sales-history",
  "pending-payments",
]);

const normalizeAccountPart = (value: string) => (
  value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account"
);

export function createPosPreferencesStorageKey(account: PosPreferenceAccount): string {
  if (account.id) return `pharm_pos_preferences:account:${normalizeAccountPart(account.id)}`;
  return `pharm_pos_preferences:${normalizeAccountPart(account.role)}:${normalizeAccountPart(account.name)}`;
}

export function loadPosPreferences(
  storage: Pick<PreferenceStorage, "getItem">,
  account: PosPreferenceAccount,
): PosPreferences {
  let parsed: unknown;
  try {
    const savedValue = storage.getItem(createPosPreferencesStorageKey(account));
    parsed = savedValue ? JSON.parse(savedValue) : null;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_POS_PREFERENCES };
  const saved = parsed as Partial<Record<keyof PosPreferences, unknown>>;

  return {
    showAvailableStock: typeof saved.showAvailableStock === "boolean"
      ? saved.showAvailableStock
      : DEFAULT_POS_PREFERENCES.showAvailableStock,
    showKeyboardHints: typeof saved.showKeyboardHints === "boolean"
      ? saved.showKeyboardHints
      : DEFAULT_POS_PREFERENCES.showKeyboardHints,
    confirmDestructiveActions: typeof saved.confirmDestructiveActions === "boolean"
      ? saved.confirmDestructiveActions
      : DEFAULT_POS_PREFERENCES.confirmDestructiveActions,
    showPaymentMethodAfterNetTotal: typeof saved.showPaymentMethodAfterNetTotal === "boolean"
      ? saved.showPaymentMethodAfterNetTotal
      : DEFAULT_POS_PREFERENCES.showPaymentMethodAfterNetTotal,
    defaultSalesLanding: typeof saved.defaultSalesLanding === "string" && SALES_LANDINGS.has(saved.defaultSalesLanding as SalesLanding)
      ? saved.defaultSalesLanding as SalesLanding
      : DEFAULT_POS_PREFERENCES.defaultSalesLanding,
  };
}

export function savePosPreferences(
  storage: Pick<PreferenceStorage, "setItem">,
  account: PosPreferenceAccount,
  preferences: PosPreferences,
): void {
  storage.setItem(createPosPreferencesStorageKey(account), JSON.stringify(preferences));
}

export function getSalesLandingHref(landing: SalesLanding): string {
  if (landing === "sales-history") return "/sales";
  if (landing === "pending-payments") return "/sales?status=pending";
  return "/sales/new";
}

export function requiresPosConfirmation(
  preferences: PosPreferences,
  action: "remove-item" | "cancel-sale",
  hasUnsavedSale: boolean,
): boolean {
  if (!preferences.confirmDestructiveActions) return false;
  if (action === "cancel-sale") return hasUnsavedSale;
  return true;
}
