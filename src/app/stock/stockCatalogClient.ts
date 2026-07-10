import type { SalesProduct } from "@/server/db/types";

const STOCK_CACHE_TTL_MS = 5_000;

let cachedCatalog: { products: SalesProduct[]; expiresAt: number } | null = null;
let catalogRequest: Promise<SalesProduct[]> | null = null;

export function updateStockCatalog(products: SalesProduct[]): void {
  cachedCatalog = {
    products,
    expiresAt: Date.now() + STOCK_CACHE_TTL_MS,
  };
}

export function invalidateStockCatalog(): void {
  cachedCatalog = null;
}

export async function loadStockCatalog(fetcher: typeof fetch = fetch): Promise<SalesProduct[]> {
  if (cachedCatalog && Date.now() < cachedCatalog.expiresAt) {
    return cachedCatalog.products;
  }
  if (catalogRequest) return catalogRequest;

  catalogRequest = (async () => {
    const response = await fetcher("/api/stock", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load stock catalog.");
    const data = await response.json() as { products?: SalesProduct[] };
    if (!Array.isArray(data.products)) throw new Error("Stock catalog response is invalid.");
    updateStockCatalog(data.products);
    return data.products;
  })();

  try {
    return await catalogRequest;
  } finally {
    catalogRequest = null;
  }
}
