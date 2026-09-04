import {
  deleteStockProduct,
  invalidateStockCatalog,
  loadStockProductsByIds,
  saveStockProduct,
  saveStockProductPhotoUrl,
  uploadStockProductPhoto,
} from "@/api/stockCatalogClient";
import type { ProductEditorAdapter } from "./productEditorLifecycle";

export function createHttpProductEditorAdapter(
  fetcher: typeof fetch = fetch,
): ProductEditorAdapter {
  return {
    load: async (productId) => (await loadStockProductsByIds([productId], fetcher))[0] ?? null,
    save: (item) => saveStockProduct(item, fetcher),
    savePhotoUrl: (productId, photoUrl) => (
      saveStockProductPhotoUrl(productId, photoUrl, fetcher)
    ),
    uploadPhoto: (productId, file) => uploadStockProductPhoto(productId, file, fetcher),
    delete: (productId) => deleteStockProduct(productId, fetcher),
    invalidateCache: invalidateStockCatalog,
  };
}
