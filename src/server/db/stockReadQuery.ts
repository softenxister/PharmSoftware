export const DEFAULT_STOCK_PAGE_SIZE = 50;
export const MAX_STOCK_PAGE_SIZE = 100;
const MAX_STOCK_QUERY_LENGTH = 120;
const MAX_STOCK_PRODUCT_IDS = 100;
const MAX_STOCK_FILTER_VALUES = 50;
const MAX_STOCK_FILTER_LENGTH = 120;

const VALID_EXPIRY_WINDOWS = new Set([
  "Expired",
  "Within 30 days",
  "31–90 days",
  "91–180 days",
  "181–365 days",
  "Over 1 year",
  "No expiry date",
]);
const VALID_STOCK_LEVELS = new Set(["Out of Stock", "Low Stock", "Normal Stock", "Overstock"]);

export const STOCK_SORTS = ["name", "weekly", "minimum", "maximum", "stock", "sellPrice"] as const;
export type StockSort = (typeof STOCK_SORTS)[number];
export type StockSortDirection = "asc" | "desc";

export type StockReadFilters = {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: string[];
  manufacturers: string[];
  tags: string[];
  stockLevels: string[];
  stockRange: { min: number | null; max: number | null } | null;
};

export type StockReadQuery = {
  page: number;
  pageSize: number;
  query: string;
  sort: StockSort;
  sortDirection: StockSortDirection;
  productIds: string[];
  filters: StockReadFilters;
};

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function repeatedFilterValues(
  params: URLSearchParams,
  key: string,
  allowed?: ReadonlySet<string>,
): string[] {
  return [...new Set(params.getAll(key)
    .map((value) => value.trim().slice(0, MAX_STOCK_FILTER_LENGTH))
    .filter((value) => value && (!allowed || allowed.has(value))))]
    .slice(0, MAX_STOCK_FILTER_VALUES);
}

function nonNegativeInteger(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function parseStockRange(params: URLSearchParams): StockReadFilters["stockRange"] {
  const min = nonNegativeInteger(params.get("stockMin"));
  const max = nonNegativeInteger(params.get("stockMax"));
  if (min === null && max === null) return null;
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) return null;
  if (min !== null && max !== null && min > max) return null;
  return { min, max };
}

export function parseStockReadQuery(url: string): StockReadQuery {
  const params = new URL(url).searchParams;
  const page = positiveInteger(params.get("page"), 1);
  const requestedPageSize = positiveInteger(params.get("pageSize"), DEFAULT_STOCK_PAGE_SIZE);
  const query = (params.get("q") ?? "").trim().slice(0, MAX_STOCK_QUERY_LENGTH);
  const requestedSort = params.get("sort");
  const sort: StockSort = STOCK_SORTS.includes(requestedSort as StockSort)
    ? requestedSort as StockSort
    : "name";
  const sortDirection: StockSortDirection = params.get("direction") === "desc" ? "desc" : "asc";
  const productIds = [...new Set(
    (params.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )].slice(0, MAX_STOCK_PRODUCT_IDS);
  const filters: StockReadFilters = {
    categories: repeatedFilterValues(params, "category"),
    dosageTypes: repeatedFilterValues(params, "dosageType"),
    expiryWindows: repeatedFilterValues(params, "expiry", VALID_EXPIRY_WINDOWS),
    manufacturers: repeatedFilterValues(params, "manufacturer"),
    tags: repeatedFilterValues(params, "tag"),
    stockLevels: repeatedFilterValues(params, "stockLevel", VALID_STOCK_LEVELS),
    stockRange: parseStockRange(params),
  };

  return {
    page,
    pageSize: Math.min(requestedPageSize, MAX_STOCK_PAGE_SIZE),
    query,
    sort,
    sortDirection,
    productIds,
    filters,
  };
}
