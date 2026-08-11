import type {
  SalesProduct,
  StockInventoryMetadata,
  StockItemInput,
  StockProductPage,
} from "@server/db/types";
import type { StockReadFilters, StockSort } from "@server/db/stock/stockReadQuery";

const STOCK_CACHE_TTL_MS = 5_000;
const MAX_CACHE_ENTRIES = 40;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
export const PRODUCT_PHOTO_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export const MAX_PRODUCT_PHOTO_FILE_BYTES = 8 * 1024 * 1024;

export type StockPage = StockProductPage;
export type StockInventoryPage = StockProductPage & { inventory: StockInventoryMetadata };

export type StockSortDirection = "asc" | "desc";
export type StockPageOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
  sort?: StockSort;
  sortDirection?: StockSortDirection;
  productIds?: string[];
  filters?: StockReadFilters;
  includeInventoryMetadata?: boolean;
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
    sort: options.sort ?? "name",
  });
  if (options.includeInventoryMetadata) params.set("inventory", "1");
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
    for (const regulatoryForm of filters.regulatoryForms) {
      params.append("regulatoryForm", regulatoryForm);
    }
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
    && typeof page.hasMore === "boolean"
    && (page.inventory === undefined || isStockInventoryMetadata(page.inventory));
}

function isStockInventoryMetadata(value: unknown): value is StockInventoryMetadata {
  if (!value || typeof value !== "object") return false;
  const inventory = value as Partial<StockInventoryMetadata>;
  const facets = inventory.facets;
  const counts = inventory.counts;
  const stringList = (list: unknown) => (
    Array.isArray(list) && list.every((entry) => typeof entry === "string")
  );
  return Boolean(
    facets
    && stringList(facets.dosageTypes)
    && stringList(facets.manufacturers)
    && stringList(facets.tags)
    && counts
    && Number.isSafeInteger(counts.lowStock)
    && counts.lowStock >= 0
    && Number.isSafeInteger(counts.overstock)
    && counts.overstock >= 0
  );
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

export function loadStockPage(
  options: StockPageOptions & { includeInventoryMetadata: true },
  fetcher?: typeof fetch,
): Promise<StockInventoryPage>;
export function loadStockPage(
  options?: StockPageOptions,
  fetcher?: typeof fetch,
): Promise<StockPage>;
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
    if (options.includeInventoryMetadata && !data.inventory) {
      throw new Error("Stock response is invalid.");
    }
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

export async function refreshStockProductsByIds(
  productIds: string[],
  fetcher: typeof fetch = fetch,
): Promise<SalesProduct[]> {
  invalidateStockCatalog();
  return loadStockProductsByIds(productIds, fetcher);
}

export async function saveStockProduct(
  input: StockItemInput,
  fetcher: typeof fetch = fetch,
): Promise<SalesProduct> {
  const response = await fetcher("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data: unknown = await response.json().catch(() => null);
  const payload = data && typeof data === "object"
    ? data as { product?: SalesProduct; error?: unknown }
    : {};
  if (!response.ok || !payload.product) {
    const message = typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "Unable to save stock item.";
    throw new Error(message);
  }
  return payload.product;
}

export async function saveStockProductPhotoUrl(
  productId: string,
  photoUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ productId: string; imageUrl: string }> {
  const response = await fetcher("/api/stock/photo-url", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, photoUrl }),
  });
  const data: unknown = await response.json().catch(() => null);
  const payload = data && typeof data === "object"
    ? data as { result?: unknown; error?: unknown }
    : {};
  const result = payload.result && typeof payload.result === "object"
    ? payload.result as { productId?: unknown; imageUrl?: unknown }
    : null;
  if (
    !response.ok
    || !result
    || typeof result.productId !== "string"
    || typeof result.imageUrl !== "string"
  ) {
    const message = typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "Unable to save this photo URL.";
    throw new Error(message);
  }
  return { productId: result.productId, imageUrl: result.imageUrl };
}

export function validateProductPhotoFile(file: Pick<File, "size" | "type">): string | null {
  if (file.size === 0) return "Choose a non-empty product image.";
  if (file.size > MAX_PRODUCT_PHOTO_FILE_BYTES) return "Product images must not exceed 8 MiB.";
  if (!PRODUCT_PHOTO_FILE_TYPES.includes(file.type as typeof PRODUCT_PHOTO_FILE_TYPES[number])) {
    return "Choose a PNG, JPEG, WebP, or AVIF product image.";
  }
  return null;
}

export async function uploadStockProductPhoto(
  productId: string,
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<{ productId: string; imageUrl: string }> {
  const response = await fetcher(`/api/stock/photos/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const data: unknown = await response.json().catch(() => null);
  const payload = data && typeof data === "object"
    ? data as { result?: unknown; error?: unknown }
    : {};
  const result = payload.result && typeof payload.result === "object"
    ? payload.result as { productId?: unknown; imageUrl?: unknown }
    : null;
  if (
    !response.ok
    || !result
    || typeof result.productId !== "string"
    || typeof result.imageUrl !== "string"
  ) {
    const message = typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "Unable to upload this product photo.";
    throw new Error(message);
  }
  return { productId: result.productId, imageUrl: result.imageUrl };
}
