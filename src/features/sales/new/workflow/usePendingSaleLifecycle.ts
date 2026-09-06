import { useCallback, useEffect, useState } from "react";
import type { StorePaymentMethod } from "@/config/preferences/storePosSettings";
import {
  createPendingSaleLoadCoordinator,
  createPendingSaleLifecycle,
  type PendingSaleDraft,
  type PendingSaleOpenResult,
  type PendingSaleSession,
} from "./pendingSaleLifecycle";
import { createHttpPendingSaleAdapter } from "./salePersistence";

type PendingSaleLoadState = "idle" | "loading" | "opened" | "unavailable";

export function usePendingSaleLifecycle({
  requestedSaleId,
  dependenciesReady,
  enabledPaymentMethods,
}: {
  requestedSaleId: string | null;
  dependenciesReady: boolean;
  enabledPaymentMethods: readonly StorePaymentMethod[];
}) {
  const [lifecycle] = useState(() => createPendingSaleLifecycle(createHttpPendingSaleAdapter()));
  const [loads] = useState(createPendingSaleLoadCoordinator);
  const [session, setSession] = useState<PendingSaleSession | null>(null);
  const [openResult, setOpenResult] = useState<PendingSaleOpenResult | null>(null);
  const [loadState, setLoadState] = useState<PendingSaleLoadState>(
    requestedSaleId ? "loading" : "idle",
  );
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => () => {
    lifecycle.cancelPendingWrites();
    loads.reset();
  }, [lifecycle, loads]);

  useEffect(() => {
    if (!requestedSaleId) {
      loads.reset();
      setSession(null);
      setOpenResult(null);
      setLoadState("idle");
      return;
    }
    if (!dependenciesReady) {
      setLoadState("loading");
      return;
    }

    const requestKey = `${requestedSaleId}:${retryVersion}`;
    const cancel = loads.run(requestKey, () => lifecycle.open({
      saleId: requestedSaleId,
      enabledPaymentMethods,
    }), (result) => {
      setOpenResult(result);
      if (result.kind === "opened") {
        setSession(result.session);
        setLoadState("opened");
      } else {
        setLoadState("unavailable");
      }
    });

    if (!cancel) return;
    setSession(null);
    setOpenResult(null);
    setLoadState("loading");
    return cancel;
  }, [
    dependenciesReady,
    enabledPaymentMethods,
    lifecycle,
    loads,
    requestedSaleId,
    retryVersion,
  ]);

  const save = useCallback(async (
    draft: PendingSaleDraft,
    totals: { subtotal: number; netPayable: number },
  ) => {
    const result = await lifecycle.save({ session, draft, ...totals });
    if (result.kind === "saved") setSession(result.session);
    return result;
  }, [lifecycle, session]);

  const remove = useCallback(async () => {
    if (!session) {
      return { kind: "conflict", message: "This Pending Sale is no longer available." } as const;
    }
    return lifecycle.delete(session);
  }, [lifecycle, session]);

  const hasMeaningfulChanges = useCallback((draft: PendingSaleDraft) => (
    session ? lifecycle.hasMeaningfulChanges(session, draft) : false
  ), [lifecycle, session]);

  const clear = useCallback(() => {
    lifecycle.cancelPendingWrites();
    loads.reset();
    setSession(null);
    setOpenResult(null);
    setLoadState("idle");
  }, [lifecycle, loads]);

  return {
    session,
    opened: openResult?.kind === "opened" ? openResult : null,
    unavailable: openResult?.kind === "unavailable" ? openResult : null,
    loadState,
    hasMeaningfulChanges,
    save,
    remove,
    clear,
    retry: () => setRetryVersion((version) => version + 1),
  };
}
