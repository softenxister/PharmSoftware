import type { SalesProduct, StockItemInput } from "@server/db/types";
import type { StockSort } from "@server/db/stock/stockReadQuery";
import type {
  StockPage,
  StockSortDirection,
} from "@/api/stockCatalogClient";
import { getStockMeasurementLabel } from "@/lib/productMeasurement";
import { markupPercent } from "@/lib/stockCost";

export const STOCK_PAGE_SIZE = 50;
export const SIDEBAR_MIN_WIDTH = 230;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_DEFAULT_WIDTH = 270;
const SIDEBAR_CLOSE_DRAG_DISTANCE = 110;
const SIDEBAR_REOPEN_DRAG_DISTANCE = 110;

export type StockSidebarDragResult = {
  isClosed: boolean;
  width: number;
};

export function clampStockSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

export function resizeStockSidebarFromDrag(
  startWidth: number,
  pointerDelta: number,
): StockSidebarDragResult {
  const requestedWidth = startWidth + pointerDelta;
  if (requestedWidth <= SIDEBAR_MIN_WIDTH - SIDEBAR_CLOSE_DRAG_DISTANCE) {
    return { isClosed: true, width: SIDEBAR_MIN_WIDTH };
  }
  return { isClosed: false, width: clampStockSidebarWidth(requestedWidth) };
}

export function reopenStockSidebarFromEdgeDrag(pointerDelta: number): StockSidebarDragResult {
  if (pointerDelta < SIDEBAR_REOPEN_DRAG_DISTANCE) {
    return { isClosed: true, width: SIDEBAR_MIN_WIDTH };
  }
  return {
    isClosed: false,
    width: clampStockSidebarWidth(
      SIDEBAR_MIN_WIDTH + pointerDelta - SIDEBAR_REOPEN_DRAG_DISTANCE,
    ),
  };
}

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
export type StockState = "normal" | "low" | "overstock";
export type StockTableSortKey = Exclude<StockSort, "weekly">;
export type StockFilterPanel =
  | "category"
  | "dosageType"
  | "expiry"
  | "stock"
  | "stockRange"
  | "manufacturer"
  | "tags"
  | "stockAdjustment";

export type StockTableSort = {
  key: StockTableSortKey;
  direction: StockSortDirection;
};

export type StockRange = {
  min: number | null;
  max: number | null;
};

export type AppliedStockInventoryFilters = {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: ExpiryWindow[];
  manufacturers: string[];
  tags: string[];
  stockLevels: StockLevel[];
  stockRange: StockRange | null;
};

export type DraftStockFilters = {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: ExpiryWindow[];
  stockLevels: StockLevel[];
  manufacturers: string[];
  tags: string[];
  adjustmentStatuses: string[];
  minimumStock: string;
  maximumStock: string;
};

export type MultiSelectFilterKey = keyof Pick<
  DraftStockFilters,
  | "categories"
  | "dosageTypes"
  | "expiryWindows"
  | "stockLevels"
  | "manufacturers"
  | "tags"
  | "adjustmentStatuses"
>;

export type StockInventoryItem = {
  id: string;
  barcodes: string[];
  name: string;
  brand: string;
  manufacturer: string;
  tagName: string;
  category: string;
  dosageType: string;
  expiryDates: string[];
  pack: string;
  min: number;
  max: number;
  stock: number;
  cost: number;
  markupPercent?: number;
  sellPrice: number;
  imageUrl: string;
  state: StockState;
};

export function roundMarkupPercentForDisplay(value: number): number {
  return Math.ceil(value);
}

export function createEmptyDraftFilters(): DraftStockFilters {
  return {
    categories: [],
    dosageTypes: [],
    expiryWindows: [],
    stockLevels: [],
    manufacturers: [],
    tags: [],
    adjustmentStatuses: [],
    minimumStock: "",
    maximumStock: "",
  };
}

export function createEmptyAppliedFilters(): AppliedStockInventoryFilters {
  return {
    categories: [],
    dosageTypes: [],
    expiryWindows: [],
    manufacturers: [],
    tags: [],
    stockLevels: [],
    stockRange: null,
  };
}

export function toggleSelectedOption<T extends string>(options: T[], option: string): T[] {
  const selected = option as T;
  return options.includes(selected)
    ? options.filter((current) => current !== selected)
    : [...options, selected];
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function buildFilterOptions(
  defaultOptions: readonly string[],
  availableOptions: string[],
): string[] {
  const options = [...defaultOptions];
  const seen = new Set(options.map(normalizeFilterValue));
  const additional = availableOptions
    .map((option) => option.trim())
    .filter((option) => {
      const key = normalizeFilterValue(option);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.localeCompare(second, "en-US"));
  return [...options, ...additional];
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
  const invalid = bounds.some((value) => !Number.isInteger(value) || value < 0);
  if (invalid || (min !== null && max !== null && min > max)) {
    return { range: null, isValid: false };
  }
  return { range: { min, max }, isValid: true };
}

export function projectStockInventoryItem(product: SalesProduct): StockInventoryItem {
  const stock = product.batches.reduce((sum, batch) => sum + batch.availableStock, 0);
  const min = product.minimumStock ?? 20;
  const max = product.maximumStock ?? 200;
  return {
    id: product.barcode,
    barcodes: [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ],
    name: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    tagName: product.tagName ?? "",
    category: product.category,
    dosageType: product.pack.childUnit,
    expiryDates: product.batches.map((batch) => batch.expiryDate),
    pack: getStockMeasurementLabel(product),
    min,
    max,
    stock,
    cost: product.averageCostThb ?? 0,
    markupPercent: markupPercent(
      product.batches[0]?.sellPriceThb ?? 0,
      product.averageCostThb,
    ),
    sellPrice: product.batches[0]?.sellPriceThb ?? 0,
    imageUrl: product.imageUrl,
    state: stock < min ? "low" : stock > max ? "overstock" : "normal",
  };
}

export function projectAuthoritativeInventoryPage(page: StockPage) {
  return {
    products: page.products,
    items: page.products.map(projectStockInventoryItem),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    hasMore: page.hasMore,
  };
}

export function productToStockItemInput(product: SalesProduct): StockItemInput {
  const firstBatch = product.batches[0];
  return {
    productId: product.id,
    photoUrl: product.imageUrl,
    barcode: [product.barcode, ...(product.barcodes ?? [])].join(", "),
    itemName: product.itemName,
    lotNo: firstBatch?.batchNo ?? "",
    expiryDate: firstBatch?.expiryDate ?? "",
    location: product.location,
    manufacturer: product.manufacturerName,
    sellPrice: String(firstBatch?.sellPriceThb ?? ""),
    itemCategory: product.category,
    weightage: String(product.pack.childQuantity),
    subUnit: product.pack.childUnit,
    unit: product.pack.packUnit,
    brandName: product.brandName,
    packagingRows: product.parentPacks.map((pack) => ({
      parentUnit: pack.packUnit,
      childQuantity: String(pack.childPackQuantity),
      childUnit: pack.childPackUnit,
      barcode: (pack.barcodes ?? []).join(", "),
      sellPrice: pack.sellPriceThb === undefined ? "" : String(pack.sellPriceThb),
    })),
  };
}
