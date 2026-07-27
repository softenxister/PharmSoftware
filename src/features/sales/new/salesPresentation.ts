import { formatDate } from "@/i18n/i18n";
import type { AppLocale } from "@/config/preferences/appPreferences";
import { nearestAvailableExpiryBatch } from "@/lib/batchPresentation";
import type { ParentPack, ProductPack } from "@server/db/types";

type ProductDescriptionInput = {
  brand: string;
  packLabel: string;
  location: string;
  totalStock: number;
  showLocation: boolean;
  showStock: boolean;
};

export { calculateSalePricing } from "@/lib/salePricing";

const THAI_KEYBOARD_DIGITS: Readonly<Record<string, string>> = {
  "ๅ": "1",
  "/": "2",
  "-": "3",
  "*": "3",
  "_": "3",
  "ภ": "4",
  "ถ": "5",
  "ุ": "6",
  "ึ": "7",
  "ค": "8",
  "ต": "9",
  "จ": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
  "๐": "0",
};

function translateThaiKeyboardDigits(value: string, requireAllCharacters: boolean): string | null {
  let translated = "";
  for (const character of value) {
    if (/^\d$/.test(character)) {
      translated += character;
      continue;
    }
    const digit = THAI_KEYBOARD_DIGITS[character];
    if (digit !== undefined) {
      translated += digit;
      continue;
    }
    if (requireAllCharacters) return null;
    translated += character;
  }
  return translated;
}

export function normalizeThaiKeyboardBarcodeInput(value: string): string {
  const candidate = value.trim();
  if (candidate.length < 5) return value;
  return translateThaiKeyboardDigits(candidate, true) ?? value;
}

export function normalizeThaiKeyboardNumericInput(value: string): string {
  return translateThaiKeyboardDigits(value, false) ?? value;
}

export function topWeeklyItemIds<T extends { id: string; weeklySold: number }>(
  products: readonly T[],
): string[] {
  return products
    .filter((product) => Number.isFinite(product.weeklySold) && product.weeklySold > 0)
    .sort((first, second) => second.weeklySold - first.weeklySold)
    .slice(0, 10)
    .map((product) => product.id);
}

function boundedAvailableQuantity(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function totalAvailableSaleQuantity<T>(
  batches: readonly T[],
  availableQuantity: (batch: T) => number,
): number {
  return batches.reduce(
    (total, batch) => total + boundedAvailableQuantity(availableQuantity(batch)),
    0,
  );
}

export function allocateSaleQuantityAcrossBatches<T>(
  batches: readonly T[],
  selectedBatch: T,
  requestedQuantity: number,
  availableQuantity: (batch: T) => number,
): Array<{ batch: T; quantity: number }> {
  let remaining = boundedAvailableQuantity(requestedQuantity);
  if (remaining === 0) return [];

  const selectedIndex = batches.indexOf(selectedBatch);
  const orderedBatches = selectedIndex >= 0
    ? [selectedBatch, ...batches.filter((_, index) => index !== selectedIndex)]
    : [...batches];
  const allocations: Array<{ batch: T; quantity: number }> = [];

  for (const batch of orderedBatches) {
    const quantity = Math.min(remaining, boundedAvailableQuantity(availableQuantity(batch)));
    if (quantity <= 0) continue;
    allocations.push({ batch, quantity });
    remaining -= quantity;
    if (remaining === 0) break;
  }

  return allocations;
}

export function groupSaleLinesForDisplay<T>(
  lines: readonly T[],
  groupKey: (line: T) => string,
  quantity: (line: T) => number,
  expiryDate: (line: T) => string,
): Array<{
  key: string;
  lines: T[];
  representative: T;
  quantity: number;
}> {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const key = groupKey(line);
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }

  return [...groups.entries()].flatMap(([key, group]) => {
    const representative = nearestAvailableExpiryBatch(
      group,
      expiryDate,
      () => 1,
    );
    if (!representative) return [];
    return [{
      key,
      lines: group,
      representative,
      quantity: group.reduce(
        (total, line) => total + boundedAvailableQuantity(quantity(line)),
        0,
      ),
    }];
  });
}

export function formatBatchExpiry(locale: AppLocale, value: string): string {
  const normalized = value.trim();
  if (!normalized) return "-";

  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  const date = dayFirst
    ? new Date(Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1])))
    : new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  const formatted = formatDate(locale, date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return locale === "en" ? formatted.toLocaleUpperCase("en-GB") : formatted;
}

const formatStock = (value: number) => Number.isFinite(value)
  ? value.toLocaleString("en-US", { maximumFractionDigits: 3 })
  : "0";

export function buildProductDescription(input: ProductDescriptionInput): string {
  const parts = [input.brand, input.packLabel];
  if (input.showLocation && input.location.trim()) parts.push(input.location.trim());
  if (input.showStock) parts.push(`${formatStock(input.totalStock)} stock`);
  return parts.filter(Boolean).join(" - ");
}

export function shouldUseSellPackDropdown(sellPackCount: number): boolean {
  return Number.isFinite(sellPackCount) && sellPackCount > 1;
}

export type SellPackOption = {
  key: string;
  unit: string;
  label: string;
  relationLabel: string;
  displayLabel: string;
  priceMultiplier: number;
  sellPriceThb?: number;
  barcodes: string[];
};

export function displayPackUnit(unit: string): string {
  if (unit === "blisterpack") return "blister packs";
  return unit;
}

function sellPackButtonLabel(unit: string): string {
  if (unit === "blisterpack") return "blister";
  return unit;
}

function quantityKey(quantity: number): string {
  return Number.isFinite(quantity) ? String(quantity) : "0";
}

export function buildSellPackOptions(
  pack: ProductPack,
  parentPacks: readonly ParentPack[],
  baseBarcodes: readonly string[] = [],
): SellPackOption[] {
  return [
    {
      key: `base:${pack.packUnit}`,
      unit: pack.packUnit,
      label: sellPackButtonLabel(pack.packUnit),
      relationLabel: pack.label,
      displayLabel: `${pack.childQuantity} / ${displayPackUnit(pack.packUnit)}`,
      priceMultiplier: 1,
      barcodes: [...baseBarcodes],
    },
    ...parentPacks.map((parentPack) => {
      const quantity = quantityKey(parentPack.childPackQuantity);
      return {
        key: parentPack.id ?? `parent:${parentPack.packUnit}:${parentPack.childPackUnit}:${quantity}`,
        unit: parentPack.packUnit,
        label: `${sellPackButtonLabel(parentPack.packUnit)}(${quantity})`,
        relationLabel: parentPack.label,
        displayLabel: `${parentPack.childPackQuantity} / ${displayPackUnit(parentPack.packUnit)}`,
        priceMultiplier: parentPack.priceMultiplier,
        ...(parentPack.sellPriceThb === undefined ? {} : { sellPriceThb: parentPack.sellPriceThb }),
        barcodes: [...(parentPack.barcodes ?? [])],
      };
    }),
  ];
}

export type PaidSaleNextStep =
  | { kind: "invoice-preview" }
  | {
    kind: "receipt-route";
    path: string;
    resetOriginalSale: true;
    target: "new-tab";
  };

export function resolvePaidSaleNextStep(
  action: "submit" | "print",
  saleId: string,
): PaidSaleNextStep {
  if (action === "submit") return { kind: "invoice-preview" };
  return {
    kind: "receipt-route",
    path: `/sales/receipt/${encodeURIComponent(saleId)}`,
    resetOriginalSale: true,
    target: "new-tab",
  };
}

export type DefaultReminderState = {
  enabled: boolean;
  activeTime: number;
  doses: [number, number, number, number];
};

export function createReminderFromDefaultDosage(
  dosage: readonly number[] | undefined,
): DefaultReminderState {
  const doses = dosage?.length === 4 && dosage.every((dose) => Number.isInteger(dose) && dose >= 0 && dose <= 99)
    ? [...dosage] as [number, number, number, number]
    : [0, 0, 0, 0] as [number, number, number, number];
  return { enabled: doses.some((dose) => dose > 0), activeTime: 0, doses };
}
