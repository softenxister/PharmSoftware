export const STORE_PAYMENT_METHODS = ["Cash", "Bank transfer", "Credit card"] as const;

export type StorePaymentMethod = typeof STORE_PAYMENT_METHODS[number];

export const STORE_BILLING_DEVICES = [
  "Front Counter Thermal Printer",
  "Back Counter Thermal Printer",
  "PDF Preview Only",
  "USB Receipt Printer",
] as const;
export type StoreBillingDevice = typeof STORE_BILLING_DEVICES[number];

export const STORE_PAPER_SIZES = ["80", "58"] as const;
export type StorePaperSize = typeof STORE_PAPER_SIZES[number];

export const STORE_CASH_DRAWER_DEVICES = [
  "Front Counter Cash Drawer",
  "Back Counter Cash Drawer",
  "Printer-connected Drawer",
  "No Cash Drawer",
] as const;
export type StoreCashDrawerDevice = typeof STORE_CASH_DRAWER_DEVICES[number];

export type StorePosSettings = {
  showProductLocation: boolean;
  paymentMethods: StorePaymentMethod[];
  billingDevice: StoreBillingDevice;
  paperSize: StorePaperSize;
  cashDrawerDevice: StoreCashDrawerDevice;
  autoOpenCashDrawer: boolean;
};

export const DEFAULT_STORE_POS_SETTINGS: Readonly<StorePosSettings> = Object.freeze({
  showProductLocation: false,
  paymentMethods: [...STORE_PAYMENT_METHODS],
  billingDevice: "Front Counter Thermal Printer",
  paperSize: "80",
  cashDrawerDevice: "Front Counter Cash Drawer",
  autoOpenCashDrawer: true,
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

const normalizeBillingDevice = (value: unknown): StoreBillingDevice => (
  typeof value === "string" && STORE_BILLING_DEVICES.includes(value as StoreBillingDevice)
    ? value as StoreBillingDevice
    : DEFAULT_STORE_POS_SETTINGS.billingDevice
);

const normalizePaperSize = (value: unknown): StorePaperSize => (
  typeof value === "string" && STORE_PAPER_SIZES.includes(value as StorePaperSize)
    ? value as StorePaperSize
    : DEFAULT_STORE_POS_SETTINGS.paperSize
);

const normalizeCashDrawerDevice = (value: unknown): StoreCashDrawerDevice => (
  typeof value === "string" && STORE_CASH_DRAWER_DEVICES.includes(value as StoreCashDrawerDevice)
    ? value as StoreCashDrawerDevice
    : DEFAULT_STORE_POS_SETTINGS.cashDrawerDevice
);

export function normalizeStorePosSettings(value: unknown): StorePosSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_STORE_POS_SETTINGS, paymentMethods: [...DEFAULT_STORE_POS_SETTINGS.paymentMethods] };
  const candidate = value as Record<string, unknown>;
  return {
    showProductLocation: typeof candidate.showProductLocation === "boolean"
      ? candidate.showProductLocation
      : DEFAULT_STORE_POS_SETTINGS.showProductLocation,
    paymentMethods: normalizePaymentMethods(candidate.paymentMethods),
    billingDevice: normalizeBillingDevice(candidate.billingDevice),
    paperSize: normalizePaperSize(candidate.paperSize),
    cashDrawerDevice: normalizeCashDrawerDevice(candidate.cashDrawerDevice),
    autoOpenCashDrawer: typeof candidate.autoOpenCashDrawer === "boolean"
      ? candidate.autoOpenCashDrawer
      : DEFAULT_STORE_POS_SETTINGS.autoOpenCashDrawer,
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
  if (candidate.billingDevice !== undefined && !STORE_BILLING_DEVICES.includes(candidate.billingDevice as StoreBillingDevice)) return null;
  if (candidate.paperSize !== undefined && !STORE_PAPER_SIZES.includes(candidate.paperSize as StorePaperSize)) return null;
  if (candidate.cashDrawerDevice !== undefined && !STORE_CASH_DRAWER_DEVICES.includes(candidate.cashDrawerDevice as StoreCashDrawerDevice)) return null;
  if (candidate.autoOpenCashDrawer !== undefined && typeof candidate.autoOpenCashDrawer !== "boolean") return null;
  return {
    showProductLocation: candidate.showProductLocation,
    paymentMethods: normalizePaymentMethods(paymentMethods),
    billingDevice: normalizeBillingDevice(candidate.billingDevice),
    paperSize: normalizePaperSize(candidate.paperSize),
    cashDrawerDevice: normalizeCashDrawerDevice(candidate.cashDrawerDevice),
    autoOpenCashDrawer: candidate.autoOpenCashDrawer === undefined
      ? DEFAULT_STORE_POS_SETTINGS.autoOpenCashDrawer
      : candidate.autoOpenCashDrawer,
  };
}

export function shouldUsePaymentToggle(methods: readonly StorePaymentMethod[]): boolean {
  return methods.length === 2 && methods.includes("Cash") && methods.includes("Bank transfer");
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
