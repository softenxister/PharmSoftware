export const STORE_PAYMENT_METHODS = ["Cash", "Bank transfer", "Credit card"] as const;

export type StorePaymentMethod = typeof STORE_PAYMENT_METHODS[number];

export type StorePosSettings = {
  showProductLocation: boolean;
  paymentMethods: StorePaymentMethod[];
};

export const DEFAULT_STORE_POS_SETTINGS: Readonly<StorePosSettings> = Object.freeze({
  showProductLocation: false,
  paymentMethods: [...STORE_PAYMENT_METHODS],
});

const toStorePaymentMethod = (value: unknown): StorePaymentMethod | null => {
  if (value === "Mobile payment" || value === "PromptPay") return "Bank transfer";
  if (typeof value === "string" && STORE_PAYMENT_METHODS.includes(value as StorePaymentMethod)) {
    return value as StorePaymentMethod;
  }
  return null;
};

const normalizePaymentMethods = (value: unknown): StorePaymentMethod[] => {
  if (!Array.isArray(value)) return [...DEFAULT_STORE_POS_SETTINGS.paymentMethods];
  const selected = new Set(value.map(toStorePaymentMethod).filter((method): method is StorePaymentMethod => method !== null));
  const methods = STORE_PAYMENT_METHODS.filter((method) => selected.has(method));
  return methods.length > 0 ? methods : [...DEFAULT_STORE_POS_SETTINGS.paymentMethods];
};

export function normalizeStorePosSettings(value: unknown): StorePosSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_STORE_POS_SETTINGS, paymentMethods: [...DEFAULT_STORE_POS_SETTINGS.paymentMethods] };
  const candidate = value as Record<string, unknown>;
  return {
    showProductLocation: typeof candidate.showProductLocation === "boolean"
      ? candidate.showProductLocation
      : DEFAULT_STORE_POS_SETTINGS.showProductLocation,
    paymentMethods: normalizePaymentMethods(candidate.paymentMethods),
  };
}

export function parseStorePosSettingsUpdate(value: unknown): StorePosSettings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.showProductLocation !== "boolean" || !Array.isArray(candidate.paymentMethods)) return null;
  if (candidate.paymentMethods.length < 1 || candidate.paymentMethods.length > STORE_PAYMENT_METHODS.length) return null;
  const paymentMethods = candidate.paymentMethods.map(toStorePaymentMethod);
  if (paymentMethods.some((method) => method === null)) return null;
  if (new Set(paymentMethods).size !== paymentMethods.length) return null;
  return {
    showProductLocation: candidate.showProductLocation,
    paymentMethods: normalizePaymentMethods(paymentMethods),
  };
}

export function shouldUsePaymentToggle(methods: readonly StorePaymentMethod[]): boolean {
  return methods.length === 2 && methods.includes("Cash") && methods.includes("Bank transfer");
}

export function switchPaymentMethod(
  current: StorePaymentMethod,
  enabledMethods: readonly StorePaymentMethod[],
): StorePaymentMethod {
  return enabledMethods.find((method) => method !== current) ?? current;
}

export function getPaymentMethodShortcut(method: StorePaymentMethod): "F1" | "F2" | "F3" {
  if (method === "Cash") return "F1";
  if (method === "Bank transfer") return "F2";
  return "F3";
}

export function resolveConfiguredPaymentMethod(
  current: string,
  enabledMethods: readonly StorePaymentMethod[],
): StorePaymentMethod {
  const method = toStorePaymentMethod(current);
  if (method && enabledMethods.includes(method)) return method;
  return enabledMethods[0] ?? DEFAULT_STORE_POS_SETTINGS.paymentMethods[0];
}
