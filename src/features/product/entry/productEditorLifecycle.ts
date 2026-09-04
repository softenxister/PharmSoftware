import type { SalesProduct, StockItemInput } from "@server/db/types";
import { isStockPhotoUrlOnlyChange } from "@/lib/stockPhotoUrlChange";
import { productToStockItemInput } from "./productItemDraft";

export type ProductEditorAdapter = {
  load(productId: string): Promise<SalesProduct | null>;
  save(item: StockItemInput): Promise<SalesProduct>;
  savePhotoUrl(
    productId: string,
    photoUrl: string,
  ): Promise<{ productId: string; imageUrl: string }>;
  uploadPhoto(
    productId: string,
    file: File,
  ): Promise<{ productId: string; imageUrl: string }>;
  delete(productId: string): Promise<void>;
  invalidateCache(): void;
};

export type ProductEditorSession = Readonly<{
  mode: "create" | "edit";
  product: SalesProduct | null;
}>;

export type ProductEditorInventory = Readonly<{
  products: SalesProduct[];
  total: number;
}>;

export type ProductEditorOpenResult =
  | { kind: "opened"; session: ProductEditorSession }
  | {
      kind: "unavailable";
      reason: "missing" | "load-failed";
      message: string;
    };

export type ProductEditorSaveResult =
  | {
      kind: "saved";
      product: SalesProduct;
      inventory: ProductEditorInventory;
      refreshInventory: boolean;
    }
  | { kind: "failed"; message: string; refreshInventory: boolean };

export type ProductEditorDeleteResult =
  | {
      kind: "deleted";
      productId: string;
      inventory: ProductEditorInventory;
      refreshInventory: true;
    }
  | { kind: "failed"; message: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function reconcileSavedProduct(
  inventory: ProductEditorInventory,
  product: SalesProduct,
): ProductEditorInventory {
  if (!inventory.products.some(({ id }) => id === product.id)) return inventory;
  return {
    ...inventory,
    products: inventory.products.map((visible) => visible.id === product.id ? product : visible),
  };
}

function reconcileDeletedProduct(
  inventory: ProductEditorInventory,
  productId: string,
): ProductEditorInventory {
  const products = inventory.products.filter(({ id }) => id !== productId);
  if (products.length === inventory.products.length) return inventory;
  return { products, total: Math.max(0, inventory.total - 1) };
}

export function createProductEditorLifecycle(adapter: ProductEditorAdapter) {
  const editSession = (product: SalesProduct): ProductEditorSession => Object.freeze({
    mode: "edit" as const,
    product,
  });

  return {
    openCreate(): ProductEditorSession {
      return Object.freeze({ mode: "create", product: null });
    },

    openProduct(product: SalesProduct): ProductEditorSession {
      return editSession(product);
    },

    async openLinked(productId: string): Promise<ProductEditorOpenResult> {
      try {
        const product = await adapter.load(productId.trim());
        if (!product) {
          return {
            kind: "unavailable",
            reason: "missing",
            message: "This Product is no longer available.",
          };
        }
        return { kind: "opened", session: editSession(product) };
      } catch {
        return {
          kind: "unavailable",
          reason: "load-failed",
          message: "Unable to load this Product.",
        };
      }
    },

    async save(input: {
      session: ProductEditorSession;
      item: StockItemInput;
      photoFile?: File;
      inventory: ProductEditorInventory;
    }): Promise<ProductEditorSaveResult> {
      const existingProduct = input.session.product;
      if (
        !input.photoFile
        && existingProduct
        && isStockPhotoUrlOnlyChange(productToStockItemInput(existingProduct), input.item)
      ) {
        try {
          const photo = await adapter.savePhotoUrl(existingProduct.id, input.item.photoUrl);
          const product = { ...existingProduct, imageUrl: photo.imageUrl };
          adapter.invalidateCache();
          return {
            kind: "saved",
            product,
            inventory: reconcileSavedProduct(input.inventory, product),
            refreshInventory: false,
          };
        } catch (error) {
          return {
            kind: "failed",
            message: errorMessage(error, "Unable to save this Product."),
            refreshInventory: false,
          };
        }
      }

      let productWasSaved = false;
      try {
        const savedProduct = await adapter.save(input.item);
        productWasSaved = true;
        const photo = input.photoFile
          ? await adapter.uploadPhoto(savedProduct.id, input.photoFile)
          : null;
        const product = photo ? { ...savedProduct, imageUrl: photo.imageUrl } : savedProduct;
        adapter.invalidateCache();
        return {
          kind: "saved",
          product,
          inventory: reconcileSavedProduct(input.inventory, product),
          refreshInventory: true,
        };
      } catch (error) {
        if (productWasSaved) adapter.invalidateCache();
        return {
          kind: "failed",
          message: errorMessage(error, "Unable to save this Product."),
          refreshInventory: productWasSaved,
        };
      }
    },

    async delete(input: {
      session: ProductEditorSession;
      inventory: ProductEditorInventory;
    }): Promise<ProductEditorDeleteResult> {
      const productId = input.session.product?.id;
      if (!productId) return { kind: "failed", message: "No Product is selected." };
      try {
        await adapter.delete(productId);
        adapter.invalidateCache();
        return {
          kind: "deleted",
          productId,
          inventory: reconcileDeletedProduct(input.inventory, productId),
          refreshInventory: true,
        };
      } catch (error) {
        return {
          kind: "failed",
          message: errorMessage(error, "Unable to delete this Product."),
        };
      }
    },
  };
}

export type ProductEditorLifecycle = ReturnType<typeof createProductEditorLifecycle>;
