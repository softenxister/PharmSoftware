import { filterByStockCategories } from "./stockCategoryFilter";

export const COMMON_DOSAGE_TYPES = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Oral Solution",
  "Drops",
  "Cream",
  "Ointment",
  "Gel",
  "Lotion",
  "Powder",
  "Spray",
  "Inhaler",
  "Injection",
  "Suppository",
  "Patch",
] as const;

export const EXPIRY_WINDOWS = [
  "Expired",
  "Within 30 days",
  "31–90 days",
  "91–180 days",
  "181–365 days",
  "Over 1 year",
  "No expiry date",
] as const;

export const STOCK_LEVELS = ["Out of Stock", "Low Stock", "Normal Stock", "Overstock"] as const;
export const STOCK_ADJUSTMENT_STATES = ["Pending", "Completed", "Blocked"] as const;

export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];
export type StockLevel = (typeof STOCK_LEVELS)[number];

export interface StockRange {
  min: number | null;
  max: number | null;
}

export interface StockInventoryFilterItem {
  category: string;
  dosageType: string;
  expiryDates: string[];
  manufacturer: string;
  tagName: string;
  min: number;
  max: number;
  stock: number;
}

export interface AppliedStockInventoryFilters {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: ExpiryWindow[];
  manufacturers: string[];
  tags: string[];
  stockLevels: StockLevel[];
  stockRange: StockRange | null;
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function buildFilterOptions(defaultOptions: readonly string[], stockOptions: string[]): string[] {
  const options = [...defaultOptions];
  const seen = new Set(options.map(normalizeFilterValue));
  const additionalOptions = stockOptions
    .map((option) => option.trim())
    .filter((option) => {
      const key = normalizeFilterValue(option);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "en-US"));

  return [...options, ...additionalOptions];
}

export function parseStockRange(
  minimum: string,
  maximum: string,
): { range: StockRange | null; isValid: boolean } {
  const minText = minimum.trim();
  const maxText = maximum.trim();
  if (!minText && !maxText) return { range: null, isValid: true };

  const min = minText ? Number(minText) : null;
  const max = maxText ? Number(maxText) : null;
  const bounds = [min, max].filter((value): value is number => value !== null);
  const hasInvalidBound = bounds.some((value) => !Number.isInteger(value) || value < 0);
  if (hasInvalidBound || (min !== null && max !== null && min > max)) {
    return { range: null, isValid: false };
  }

  return { range: { min, max }, isValid: true };
}

function parseExpiryDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const localMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : localMatch
      ? { year: Number(localMatch[3]), month: Number(localMatch[2]), day: Number(localMatch[1]) }
      : null;
  if (!parts) return null;

  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year
    || date.getMonth() !== parts.month - 1
    || date.getDate() !== parts.day
  ) {
    return null;
  }
  return date;
}

function getNearestExpiryDays(expiryDates: string[], today: Date): number | null {
  const dates = expiryDates
    .map(parseExpiryDate)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((dates[0].getTime() - todayStart.getTime()) / 86_400_000);
}

function matchesExpiryWindow(days: number | null, window: ExpiryWindow): boolean {
  if (window === "No expiry date") return days === null;
  if (days === null) return false;
  if (window === "Expired") return days < 0;
  if (window === "Within 30 days") return days >= 0 && days <= 30;
  if (window === "31–90 days") return days >= 31 && days <= 90;
  if (window === "91–180 days") return days >= 91 && days <= 180;
  if (window === "181–365 days") return days >= 181 && days <= 365;
  return days > 365;
}

function matchesStockLevel(item: StockInventoryFilterItem, level: StockLevel): boolean {
  if (level === "Out of Stock") return item.stock <= 0;
  if (level === "Low Stock") return item.stock > 0 && item.stock < item.min;
  if (level === "Overstock") return item.stock > item.max;
  return item.stock >= item.min && item.stock <= item.max;
}

export function filterStockInventoryItems<T extends StockInventoryFilterItem>(
  items: T[],
  filters: AppliedStockInventoryFilters,
  today = new Date(),
): T[] {
  const categoryFilteredItems = filterByStockCategories(items, filters.categories);
  const dosageTypes = new Set(filters.dosageTypes.map(normalizeFilterValue));
  const manufacturers = new Set(filters.manufacturers.map(normalizeFilterValue));
  const tags = new Set(filters.tags.map(normalizeFilterValue));

  return categoryFilteredItems.filter((item) => {
    if (dosageTypes.size > 0 && !dosageTypes.has(normalizeFilterValue(item.dosageType))) return false;
    if (manufacturers.size > 0 && !manufacturers.has(normalizeFilterValue(item.manufacturer))) return false;
    if (tags.size > 0 && !tags.has(normalizeFilterValue(item.tagName))) return false;
    if (filters.stockLevels.length > 0 && !filters.stockLevels.some((level) => matchesStockLevel(item, level))) {
      return false;
    }
    if (filters.expiryWindows.length > 0) {
      const expiryDays = getNearestExpiryDays(item.expiryDates, today);
      if (!filters.expiryWindows.some((window) => matchesExpiryWindow(expiryDays, window))) return false;
    }
    if (filters.stockRange && filters.stockRange.min !== null && item.stock < filters.stockRange.min) return false;
    if (filters.stockRange && filters.stockRange.max !== null && item.stock > filters.stockRange.max) return false;
    return true;
  });
}
