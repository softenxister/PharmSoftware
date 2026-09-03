import { useCallback, useEffect, useRef, useState } from "react";
import type { StorePaymentMethod } from "@/config/preferences/storePosSettings";
import {
  createPendingSaleLifecycle,
  type PendingSaleDraft,
  type PendingSaleOpenResult,
  type PendingSaleSession,
} from "./pendingSaleLifecycle";
import { createHttpPendingSaleAdapter } from "./salePersistence";
import type { Customer } from "./saleTypes";

type PendingSaleLoadState = "idle" | "loading" | "opened" | "unavailable";

export function usePendingSaleLifecycle({
  requestedSaleId,
  customers,
  dependenciesReady,
  enabledPaymentMethods,
}: {
  requestedSaleId: string | null;
  customers: Customer[];
  dependenciesReady: boolean;
  enabledPaymentMethods: readonly StorePaymentMethod[];
}) {
  const [lifecycle] = useState(() => createPendingSaleLifecycle(createHttpPendingSaleAdapter()));
  const [session, setSession] = useState<PendingSaleSession | null>(null);
  const [openResult, setOpenResult] = useState<PendingSaleOpenResult | null>(null);
  const [loadState, setLoadState] = useState<PendingSaleLoadState>(
    requestedSaleId ? "loading" : "idle",
  );
  const [retryVersion, setRetryVersion] = useState(0);
  const openedRequestRef = useRef("");

  useEffect(() => {
    if (!requestedSaleId) {
      openedRequestRef.current = "";
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
    if (openedRequestRef.current === requestKey) return;
    openedRequestRef.current = requestKey;
    let cancelled = false;
    setSession(null);
    setOpenResult(null);
    setLoadState("loading");

    void lifecycle.open({
      saleId: requestedSaleId,
      customers,
      enabledPaymentMethods,
    }).then((result) => {
      if (cancelled) return;
      setOpenResult(result);
      if (result.kind === "opened") {
        setSession(result.session);
        setLoadState("opened");
      } else {
        setLoadState("unavailable");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    customers,
    dependenciesReady,
    enabledPaymentMethods,
    lifecycle,
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
    openedRequestRef.current = "";
    setSession(null);
    setOpenResult(null);
    setLoadState("idle");
  }, []);

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
