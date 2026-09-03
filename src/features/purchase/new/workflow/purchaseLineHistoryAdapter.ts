import type {
  PurchaseLineHistoryAdapter,
  PurchaseLineHistoryEntry,
} from "./purchaseLineEditing";

export function createHttpPurchaseLineHistoryAdapter(
  fetcher: typeof fetch = fetch,
): PurchaseLineHistoryAdapter {
  return {
    async loadLatest(productId, signal) {
      const response = await fetcher(
        `/api/purchase?productId=${encodeURIComponent(productId)}`,
        { cache: "no-store", signal },
      );
      if (!response.ok) throw new Error("Unable to load purchase history.");
      const data = await response.json() as { latestLine?: PurchaseLineHistoryEntry | null };
      return data.latestLine ?? null;
    },
  };
}
