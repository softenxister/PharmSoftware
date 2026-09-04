import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import type { SalesProduct } from "@server/db/types";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { productEditorHref } from "@/features/product/entry/productEditorRoute";
import { localizeUnitExpression } from "@/i18n/productUnits";
import {
  createPurchaseLineEditing,
  type PurchaseLineEditingSession,
  type PurchaseLineEditorDraft,
  type PurchaseLineHistoryResult,
} from "./purchaseLineEditing";
import { createHttpPurchaseLineHistoryAdapter } from "./purchaseLineHistoryAdapter";
import type {
  PurchaseDiscountTiming,
  PurchaseDiscountType,
  PurchaseLine,
} from "./purchaseDraft";

const CLOSED_DRAFT: Readonly<PurchaseLineEditorDraft> = Object.freeze({
  unit: "",
  quantity: "",
  cost: "",
  includeFreeQuantity: false,
  freeQuantity: "",
  freeUnit: "",
  lotNumber: "",
  expiryDate: "",
});

type PurchaseLineEditorInput = {
  lines: PurchaseLine[];
  setLines: Dispatch<SetStateAction<PurchaseLine[]>>;
  vatIncluded: boolean;
  discount: string;
  discountType: PurchaseDiscountType;
  discountTiming: PurchaseDiscountTiming;
  onOpen?: (product: SalesProduct) => void;
  onClose?: () => void;
};

export function usePurchaseLineEditor(input: PurchaseLineEditorInput) {
  const { t, preferences, formatMoney } = usePreferences();
  const [editing] = useState(() => createPurchaseLineEditing(
    createHttpPurchaseLineHistoryAdapter(),
  ));
  const [session, setSession] = useState<PurchaseLineEditingSession | null>(null);
  const [history, setHistory] = useState<PurchaseLineHistoryResult>({ kind: "empty" });
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const freeQuantityInputRef = useRef<HTMLInputElement>(null);
  const localizeUnit = useCallback(
    (value: string) => localizeUnitExpression(preferences.locale, value),
    [preferences.locale],
  );
  const pricingContext = useMemo(() => ({
    lines: input.lines,
    vatIncluded: input.vatIncluded,
    discount: input.discount,
    discountType: input.discountType,
    discountTiming: input.discountTiming,
  }), [
    input.discount,
    input.discountTiming,
    input.discountType,
    input.lines,
    input.vatIncluded,
  ]);
  const inspection = useMemo(
    () => session ? editing.inspect(session, pricingContext) : null,
    [editing, pricingContext, session],
  );
  const sessionKey = session
    ? `${session.mode}:${session.editingLineId ?? "new"}:${session.product.id}`
    : "closed";

  const close = useCallback(() => {
    setSession(null);
    setHistory({ kind: "empty" });
    input.onClose?.();
  }, [input.onClose]);

  const openNew = useCallback((product: SalesProduct, matchedBarcode?: string) => {
    setSession(editing.open({ product, matchedBarcode }));
    input.onOpen?.(product);
  }, [editing, input.onOpen]);

  const openExisting = useCallback((product: SalesProduct, line: PurchaseLine) => {
    setSession(editing.open({ product, line }));
    input.onOpen?.(product);
  }, [editing, input.onOpen]);

  const change = useCallback((draftChange: Partial<PurchaseLineEditorDraft>) => {
    setSession((current) => current ? editing.change(current, draftChange) : current);
  }, [editing]);

  const toggleFreeQuantity = useCallback((enabled: boolean) => {
    change({ includeFreeQuantity: enabled });
    if (!enabled) return;
    window.setTimeout(() => {
      freeQuantityInputRef.current?.focus();
      freeQuantityInputRef.current?.select();
    }, 0);
  }, [change]);

  const commit = useCallback(() => {
    if (!session) return;
    const result = editing.commit(session, pricingContext);
    if (result.kind !== "committed") return;
    input.setLines(result.lines);
    close();
  }, [close, editing, input.setLines, pricingContext, session]);

  useEffect(() => {
    if (!session) {
      setHistory({ kind: "empty" });
      return;
    }
    const controller = new AbortController();
    setHistory({ kind: "loading" });
    void editing.loadHistory(session, controller.signal).then((result) => {
      if (!controller.signal.aborted) setHistory(result);
    });
    return () => controller.abort();
  }, [editing, sessionKey]);

  useEffect(() => {
    if (!session) return;
    window.setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 0);
  }, [sessionKey]);

  const focusNextField = useCallback((currentElement: HTMLElement) => {
    const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-purchase-flow]"))
      .filter((element) => (
        !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true"
      ));
    const nextField = fields[fields.indexOf(currentElement) + 1];
    if (!nextField) return;
    nextField.focus();
    if (nextField instanceof HTMLInputElement) nextField.select();
  }, []);

  const handleEnter = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    const action = editing.keyboardAction(
      event.key,
      event.currentTarget.dataset.purchaseFlow,
    );
    if (action === "ignore") return;
    event.preventDefault();
    if (action === "submit") {
      commit();
      return;
    }
    const target = event.currentTarget;
    if (target instanceof HTMLButtonElement) target.click();
    if (target instanceof HTMLInputElement && target.type === "checkbox") target.click();
    window.setTimeout(() => focusNextField(target), 0);
  }, [commit, editing, focusNextField]);

  return {
    isOpen: session !== null,
    selectedItem: session?.product ?? null,
    openNew,
    openExisting,
    model: {
      t,
      formatMoney,
      locale: preferences.locale,
      isOpen: session !== null,
      selectedItem: session?.product ?? null,
      editingLineId: session?.editingLineId ?? null,
      draft: session?.draft ?? CLOSED_DRAFT,
      unitOptions: inspection?.unitOptions ?? [],
      actualCost: inspection?.actualCost ?? {
        baseCost: 0,
        discountPerUnit: 0,
        vatPerUnit: 0,
        actualCost: 0,
      },
      canCommit: inspection?.canCommit ?? false,
      expiryValid: inspection?.expiryValid ?? false,
      history,
      vatIncluded: input.vatIncluded,
      localizeUnit,
      refs: {
        quantityInput: quantityInputRef,
        freeQuantityInput: freeQuantityInputRef,
      },
      actions: {
        close,
        change,
        toggleFreeQuantity,
        commit,
        handleEnter,
        openStockItem: () => {
          if (!session) return;
          window.open(productEditorHref(session.product.id), "_blank", "noopener,noreferrer");
        },
      },
    },
  };
}

export type PurchaseLineEditorModel = ReturnType<typeof usePurchaseLineEditor>["model"];
