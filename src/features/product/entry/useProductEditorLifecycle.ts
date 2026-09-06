import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useSearchParams } from "react-router";
import type { SalesProduct, StockItemInput } from "@server/db/types";
import {
  createProductEditorLifecycle,
  type ProductEditorInventory,
  type ProductEditorSession,
} from "./productEditorLifecycle";
import { createHttpProductEditorAdapter } from "./productEditorPersistence";
import {
  productEditorProductId,
  withProductEditorProductId,
} from "./productEditorRoute";

type UseProductEditorLifecycleInput = {
  inventory: ProductEditorInventory;
  onReconcile(inventory: ProductEditorInventory): void;
  onRefresh(): void;
};

export function useProductEditorLifecycle(input: UseProductEditorLifecycleInput) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProductId = productEditorProductId(searchParams);
  const [lifecycle] = useState(() => (
    createProductEditorLifecycle(createHttpProductEditorAdapter())
  ));
  const [session, setSession] = useState<ProductEditorSession | null>(null);

  const replaceRouteProduct = useCallback((productId: string | null, replace = false) => {
    setSearchParams(
      (current) => withProductEditorProductId(current, productId),
      { replace },
    );
  }, [setSearchParams]);

  const close = useCallback(() => {
    setSession(null);
    if (requestedProductId) replaceRouteProduct(null, true);
  }, [replaceRouteProduct, requestedProductId]);

  const synchronizeRoute = useEffectEvent(() => {
    if (!requestedProductId) {
      if (session?.mode === "edit") setSession(null);
      return;
    }
    if (session?.product?.id === requestedProductId) return;
    let cancelled = false;
    void lifecycle.openLinked(requestedProductId).then((result) => {
      if (cancelled) return;
      if (result.kind === "opened") {
        setSession(result.session);
        return;
      }
      console.error(result.message);
      setSession(null);
      replaceRouteProduct(null, true);
    });
    return () => {
      cancelled = true;
    };
  });

  // Row clicks update the session before the router commits its transition.
  // Synchronize only when the URL changes, using the latest session so the
  // previous URL cannot close or reload the editor during that interval.
  useEffect(() => synchronizeRoute(), [requestedProductId]);

  const openCreate = useCallback(() => {
    setSession(lifecycle.openCreate());
    if (requestedProductId) replaceRouteProduct(null, true);
  }, [lifecycle, replaceRouteProduct, requestedProductId]);

  const openEdit = useCallback((barcode: string) => {
    const product = input.inventory.products.find((candidate) => candidate.barcode === barcode);
    if (!product) return;
    setSession(lifecycle.openProduct(product));
    replaceRouteProduct(product.id);
  }, [input.inventory.products, lifecycle, replaceRouteProduct]);

  const save = useCallback(async (item: StockItemInput, photoFile?: File) => {
    if (!session) throw new Error("No Product editor is open.");
    const result = await lifecycle.save({ session, item, photoFile, inventory: input.inventory });
    if (result.kind === "failed") {
      if (result.refreshInventory) input.onRefresh();
      throw new Error(result.message);
    }
    input.onReconcile(result.inventory);
    if (result.refreshInventory) input.onRefresh();
    close();
  }, [close, input, lifecycle, session]);

  const deleteProduct = useCallback(async () => {
    if (!session) throw new Error("No Product editor is open.");
    const result = await lifecycle.delete({ session, inventory: input.inventory });
    if (result.kind === "failed") throw new Error(result.message);
    input.onReconcile(result.inventory);
    if (result.refreshInventory) input.onRefresh();
    close();
  }, [close, input, lifecycle, session]);

  return {
    isOpen: session !== null,
    product: session?.product ?? null,
    openCreate,
    openEdit,
    close,
    save,
    delete: deleteProduct,
  };
}

export type ProductEditorController = ReturnType<typeof useProductEditorLifecycle>;
