import type { SalesProduct } from "@/server/db/types";
import type { StockReadFilters } from "@/server/db/stockReadQuery";

const STOCK_CACHE_TTL_MS = 5_000;
const MAX_CACHE_ENTRIES = 40;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export type StockPage = {
  products: SalesProduct[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type StockSortDirection = "asc" | "desc";

export type StockPageOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
  sort?: "name" | "weekly";
  sortDirection?: StockSortDirection;
  productIds?: string[];
  filters?: StockReadFilters;
};

let cachedPages = new Map<string, { result: StockPage; expiresAt: number }>();
let pageRequests = new Map<string, Promise<StockPage>>();

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Math.min(Number(value), maximum)
    : fallback;
}

function stockPageUrl(options: StockPageOptions): string {
  const page = boundedInteger(options.page, 1, Number.MAX_SAFE_INTEGER);
  const productIds = [...new Set((options.productIds ?? []).map((id) => id.trim()).filter(Boolean))]
    .slice(0, MAX_PAGE_SIZE);
  const requestedPageSize = productIds.length || options.pageSize;
  const pageSize = boundedInteger(requestedPageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: options.sort === "weekly" ? "weekly" : "name",
  });
  const query = options.query?.trim();
  if (query) params.set("q", query);
  if (options.sortDirection === "desc") params.set("direction", "desc");
  if (productIds.length > 0) params.set("ids", productIds.join(","));
  const filters = options.filters;
  if (filters) {
    for (const category of filters.categories) params.append("category", category);
    for (const dosageType of filters.dosageTypes) params.append("dosageType", dosageType);
    for (const expiry of filters.expiryWindows) params.append("expiry", expiry);
    for (const manufacturer of filters.manufacturers) params.append("manufacturer", manufacturer);
    for (const tag of filters.tags) params.append("tag", tag);
    for (const stockLevel of filters.stockLevels) params.append("stockLevel", stockLevel);
    if (filters.stockRange?.min !== null && filters.stockRange?.min !== undefined) {
      params.set("stockMin", String(filters.stockRange.min));
    }
    if (filters.stockRange?.max !== null && filters.stockRange?.max !== undefined) {
      params.set("stockMax", String(filters.stockRange.max));
    }
  }
  return `/api/stock?${params.toString()}`;
}

function isStockPage(value: unknown): value is StockPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<StockPage>;
  return Array.isArray(page.products)
    && Number.isSafeInteger(page.page)
    && Number(page.page) > 0
    && Number.isSafeInteger(page.pageSize)
    && Number(page.pageSize) > 0
    && Number.isSafeInteger(page.total)
    && Number(page.total) >= 0
    && typeof page.hasMore === "boolean";
}

function cachePage(key: string, result: StockPage): void {
  if (cachedPages.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cachedPages.keys().next().value;
    if (oldestKey) cachedPages.delete(oldestKey);
  }
  cachedPages.set(key, { result, expiresAt: Date.now() + STOCK_CACHE_TTL_MS });
}

export function invalidateStockCatalog(): void {
  cachedPages = new Map();
  pageRequests = new Map();
}

export async function loadStockPage(
  options: StockPageOptions = {},
  fetcher: typeof fetch = fetch,
): Promise<StockPage> {
  const url = stockPageUrl(options);
  const cached = cachedPages.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const existingRequest = pageRequests.get(url);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const response = await fetcher(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load stock.");
    const data: unknown = await response.json();
    if (!isStockPage(data)) throw new Error("Stock response is invalid.");
    cachePage(url, data);
    return data;
  })();
  pageRequests.set(url, request);

  try {
    return await request;
  } finally {
    pageRequests.delete(url);
  }
}

export async function searchStockCatalog(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<SalesProduct[]> {
  const result = await loadStockPage({
    pageSize: 20,
    query: query.trim(),
    sort: "weekly",
  }, fetcher);
  return result.products;
}

export async function loadStockProductsByIds(
  productIds: string[],
  fetcher: typeof fetch = fetch,
): Promise<SalesProduct[]> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_PAGE_SIZE);
  if (ids.length === 0) return [];
  const result = await loadStockPage({ productIds: ids }, fetcher);
  return result.products;
}
