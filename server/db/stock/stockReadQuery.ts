import {
  STOCK_REGULATORY_FORMS,
  type StockRegulatoryForm,
} from "@/lib/stockRegulatoryRecords";
import { DOSAGE_FORMS } from "@/lib/productDosageForm";

const DEFAULT_STOCK_PAGE_SIZE = 50;
const MAX_STOCK_PAGE_SIZE = 100;
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
const VALID_REGULATORY_FORMS = new Set<string>(STOCK_REGULATORY_FORMS);
const VALID_DOSAGE_FORMS = new Set<string>(DOSAGE_FORMS);
const VALID_MISSING_VALUES = new Set(["category", "price", "measurement", "barcode"]);

const STOCK_SORTS = [
  "name",
  "weekly",
  "minimum",
  "maximum",
  "stock",
  "cost",
  "markup",
  "sellPrice",
  "createdAt",
] as const;
export type StockSort = (typeof STOCK_SORTS)[number];
export type StockSortDirection = "asc" | "desc";
export type MissingStockValue = "category" | "price" | "measurement" | "barcode";

export type StockReadFilters = {
  categories: string[];
  legalCategories: string[];
  dosageTypes: string[];
  expiryWindows: string[];
  manufacturers: string[];
  tags: string[];
  stockLevels: string[];
  regulatoryForms: StockRegulatoryForm[];
  missingValues: MissingStockValue[];
  stockRange: { min: number | null; max: number | null } | null;
};

export type StockReadQuery = {
  page: number;
  pageSize: number;
  query: string;
  sort: StockSort;
  sortDirection: StockSortDirection;
  productIds: string[];
  includeInventoryMetadata: boolean;
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
    legalCategories: repeatedFilterValues(params, "legalCategory"),
    dosageTypes: repeatedFilterValues(params, "dosageType", VALID_DOSAGE_FORMS),
    expiryWindows: repeatedFilterValues(params, "expiry", VALID_EXPIRY_WINDOWS),
    manufacturers: repeatedFilterValues(params, "manufacturer"),
    tags: repeatedFilterValues(params, "tag"),
    stockLevels: repeatedFilterValues(params, "stockLevel", VALID_STOCK_LEVELS),
    regulatoryForms: repeatedFilterValues(
      params,
      "regulatoryForm",
      VALID_REGULATORY_FORMS,
    ) as StockRegulatoryForm[],
    missingValues: repeatedFilterValues(
      params,
      "missing",
      VALID_MISSING_VALUES,
    ) as MissingStockValue[],
    stockRange: parseStockRange(params),
  };

  return {
    page,
    pageSize: Math.min(requestedPageSize, MAX_STOCK_PAGE_SIZE),
    query,
    sort,
    sortDirection,
    productIds,
    includeInventoryMetadata: params.get("inventory") === "1",
    filters,
  };
}
