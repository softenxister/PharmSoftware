export const DEFAULT_STOCK_PAGE_SIZE = 50;
export const MAX_STOCK_PAGE_SIZE = 100;
const MAX_STOCK_QUERY_LENGTH = 120;
const MAX_STOCK_PRODUCT_IDS = 100;

export type StockSort = "name" | "weekly";

export type StockReadQuery = {
  page: number;
  pageSize: number;
  query: string;
  sort: StockSort;
  productIds: string[];
};

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseStockReadQuery(url: string): StockReadQuery {
  const params = new URL(url).searchParams;
  const page = positiveInteger(params.get("page"), 1);
  const requestedPageSize = positiveInteger(params.get("pageSize"), DEFAULT_STOCK_PAGE_SIZE);
  const query = (params.get("q") ?? "").trim().slice(0, MAX_STOCK_QUERY_LENGTH);
  const sort: StockSort = params.get("sort") === "weekly" ? "weekly" : "name";
  const productIds = [...new Set(
    (params.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )].slice(0, MAX_STOCK_PRODUCT_IDS);

  return {
    page,
    pageSize: Math.min(requestedPageSize, MAX_STOCK_PAGE_SIZE),
    query,
    sort,
    productIds,
  };
}
