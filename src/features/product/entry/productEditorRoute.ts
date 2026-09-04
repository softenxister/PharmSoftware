const PRODUCT_EDITOR_QUERY_KEY = "edit";

export function productEditorHref(productId: string): string {
  return `/stock?${new URLSearchParams({
    [PRODUCT_EDITOR_QUERY_KEY]: productId.trim(),
  }).toString()}`;
}

export function productEditorProductId(searchParams: URLSearchParams): string {
  return searchParams.get(PRODUCT_EDITOR_QUERY_KEY)?.trim() ?? "";
}

export function withProductEditorProductId(
  searchParams: URLSearchParams,
  productId: string | null,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (productId?.trim()) nextSearchParams.set(PRODUCT_EDITOR_QUERY_KEY, productId.trim());
  else nextSearchParams.delete(PRODUCT_EDITOR_QUERY_KEY);
  return nextSearchParams;
}
