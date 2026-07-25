export const MAX_BRAVE_IMAGE_SEARCH_PRODUCTS = 1_000;

export type BraveImageSearchRunInput = {
  limit: number;
};

export function parseBraveImageSearchRunInput(value: unknown): BraveImageSearchRunInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const limit = (value as Record<string, unknown>).limit;
  if (
    typeof limit !== "number"
    || !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_BRAVE_IMAGE_SEARCH_PRODUCTS
  ) return null;
  return { limit };
}
