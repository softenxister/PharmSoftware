const STOCK_EDITOR_QUERY_KEY = "edit";

export function stockEditorHref(productId: string): string {
  return `/stock?${new URLSearchParams({
    [STOCK_EDITOR_QUERY_KEY]: productId.trim(),
  }).toString()}`;
}

export function stockEditorProductId(searchParams: URLSearchParams): string {
  return searchParams.get(STOCK_EDITOR_QUERY_KEY)?.trim() ?? "";
}

export function withStockEditorProductId(
  searchParams: URLSearchParams,
  productId: string | null,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (productId?.trim()) nextSearchParams.set(STOCK_EDITOR_QUERY_KEY, productId.trim());
  else nextSearchParams.delete(STOCK_EDITOR_QUERY_KEY);
  return nextSearchParams;
}
