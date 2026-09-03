import type { SalesProduct } from "@server/db/types";
import {
  formatPurchaseExpiryDate,
  formatPurchaseExpiryInput,
  isPurchaseExpiryDate,
} from "@/lib/expiryDate";
import {
  calculatePurchaseTotals,
  positivePurchaseNumber,
  type PurchaseDiscountTiming,
  type PurchaseDiscountType,
  type PurchaseLine,
} from "./purchaseDraft";

export type PurchaseLineEditorDraft = {
  unit: string;
  quantity: string;
  cost: string;
  includeFreeQuantity: boolean;
  freeQuantity: string;
  freeUnit: string;
  lotNumber: string;
  expiryDate: string;
};

export type PurchaseLineHistoryEntry = {
  id: string;
  productId: string;
  purchaseBillId: string;
  billNo: string;
  date: string;
  distributor: string;
  unit: string;
  unitMultiplier: number;
  quantity: number;
  cost: number;
  freeUnit: string;
  freeUnitMultiplier: number;
  freeQuantity: number;
  batchNo: string | null;
  expiryDate: string;
};

export type PurchaseLineHistoryAdapter = {
  loadLatest(productId: string, signal?: AbortSignal): Promise<PurchaseLineHistoryEntry | null>;
};

export type PurchaseLineEditingSession = Readonly<{
  mode: "add" | "edit";
  product: SalesProduct;
  editingLineId: string | null;
  draft: Readonly<PurchaseLineEditorDraft>;
}>;

export type PurchaseLinePricingContext = {
  lines: PurchaseLine[];
  vatIncluded: boolean;
  discount: string;
  discountType: PurchaseDiscountType;
  discountTiming: PurchaseDiscountTiming;
};

export type PurchaseLineActualCost = {
  baseCost: number;
  discountPerUnit: number;
  vatPerUnit: number;
  actualCost: number;
};

export type PurchaseLineInspection = {
  unitOptions: string[];
  actualCost: PurchaseLineActualCost;
  expiryValid: boolean;
  canCommit: boolean;
};

export type PurchaseLineHistoryResult =
  | { kind: "loading" }
  | { kind: "loaded"; line: PurchaseLineHistoryEntry; actualCost: number }
  | { kind: "empty" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

export type PurchaseLineCommitResult =
  | { kind: "committed"; line: PurchaseLine; lines: PurchaseLine[] }
  | { kind: "invalid" };

function roundPurchaseCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function unitMultiplier(product: SalesProduct, unit: string): number {
  if (unit === product.pack.packUnit || unit === `${product.pack.packUnit}[1]`) return 1;
  return product.parentPacks.find((pack) => (
    `${pack.packUnit}[${pack.childPackQuantity}]` === unit
  ))?.childPackQuantity ?? 1;
}

function unitOptions(product: SalesProduct): string[] {
  return [...new Set([
    `${product.pack.packUnit || "Blister"}[1]`,
    ...product.parentPacks.map((pack) => `${pack.packUnit}[${pack.childPackQuantity}]`),
  ])];
}

function defaultUnit(product: SalesProduct, matchedBarcode?: string): string {
  const matchedPack = matchedBarcode
    ? product.parentPacks.find((pack) => (pack.barcodes ?? []).includes(matchedBarcode))
    : undefined;
  return matchedPack
    ? `${matchedPack.packUnit}[${matchedPack.childPackQuantity}]`
    : unitOptions(product)[0];
}

function draftFromLine(line: PurchaseLine): PurchaseLineEditorDraft {
  return {
    unit: line.unit,
    quantity: line.qty,
    cost: line.cost,
    includeFreeQuantity: line.freeQty.trim().length > 0,
    freeQuantity: line.freeQty,
    freeUnit: line.freeUnit,
    lotNumber: line.lotNo,
    expiryDate: line.expiryDate,
  };
}

function calculateActualCost(
  session: PurchaseLineEditingSession,
  context: PurchaseLinePricingContext,
): PurchaseLineActualCost {
  const quantity = positivePurchaseNumber(session.draft.quantity);
  const enteredCost = positivePurchaseNumber(session.draft.cost);
  if (quantity === 0 || enteredCost === 0) {
    return { baseCost: enteredCost, discountPerUnit: 0, vatPerUnit: 0, actualCost: 0 };
  }

  const existingLines = context.lines.filter((line) => line.id !== session.editingLineId);
  const draftLine = {
    qty: session.draft.quantity,
    cost: session.draft.cost,
  };
  const totals = calculatePurchaseTotals(
    [...existingLines, draftLine],
    context.vatIncluded,
    context.discount,
    context.discountType,
    context.discountTiming,
  );
  if (totals.subtotal === 0) {
    return { baseCost: enteredCost, discountPerUnit: 0, vatPerUnit: 0, actualCost: 0 };
  }

  const paidMultiplier = unitMultiplier(session.product, session.draft.unit);
  const freeMultiplier = unitMultiplier(session.product, session.draft.freeUnit);
  const freeQuantity = session.draft.includeFreeQuantity
    ? positivePurchaseNumber(session.draft.freeQuantity)
    : 0;
  const paidLineSubtotal = quantity * enteredCost;
  const equivalentQuantity = quantity + ((freeQuantity * freeMultiplier) / paidMultiplier);
  const lineAllocation = paidLineSubtotal / totals.subtotal;
  const baseCost = roundPurchaseCurrency(paidLineSubtotal / equivalentQuantity);
  const discountPerUnit = roundPurchaseCurrency(
    (totals.discountAmount * lineAllocation) / equivalentQuantity,
  );
  const vatPerUnit = roundPurchaseCurrency(
    (totals.vatAmount * lineAllocation) / equivalentQuantity,
  );
  return {
    baseCost,
    discountPerUnit,
    vatPerUnit,
    actualCost: roundPurchaseCurrency(Math.max(baseCost - discountPerUnit + vatPerUnit, 0)),
  };
}

function recordedActualCost(input: PurchaseLineHistoryEntry): number {
  const quantity = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 0;
  const cost = Number.isFinite(input.cost) && input.cost > 0 ? input.cost : 0;
  const paidMultiplier = Number.isFinite(input.unitMultiplier) && input.unitMultiplier > 0
    ? input.unitMultiplier
    : 0;
  const freeQuantity = Number.isFinite(input.freeQuantity) && input.freeQuantity > 0
    ? input.freeQuantity
    : 0;
  const freeMultiplier = Number.isFinite(input.freeUnitMultiplier) && input.freeUnitMultiplier > 0
    ? input.freeUnitMultiplier
    : 0;
  if (quantity === 0 || cost === 0 || paidMultiplier === 0) return 0;
  const equivalentQuantity = quantity + ((freeQuantity * freeMultiplier) / paidMultiplier);
  return equivalentQuantity > 0
    ? roundPurchaseCurrency((quantity * cost) / equivalentQuantity)
    : 0;
}

function isValidDraft(session: PurchaseLineEditingSession): boolean {
  const draft = session.draft;
  return Boolean(
    draft.unit
    && positivePurchaseNumber(draft.quantity) > 0
    && positivePurchaseNumber(draft.cost) > 0
    && (!draft.includeFreeQuantity || (
      draft.freeUnit && positivePurchaseNumber(draft.freeQuantity) > 0
    ))
    && isPurchaseExpiryDate(draft.expiryDate),
  );
}

function changedSession(
  session: PurchaseLineEditingSession,
  change: Partial<PurchaseLineEditorDraft>,
): PurchaseLineEditingSession {
  const expiryDate = change.expiryDate === undefined
    ? session.draft.expiryDate
    : formatPurchaseExpiryInput(change.expiryDate);
  return Object.freeze({
    ...session,
    draft: Object.freeze({ ...session.draft, ...change, expiryDate }),
  });
}

export function purchaseLineUnitDisplayValue(value: string): string {
  return value.replace(/\[1\]$/, "");
}

export function isPurchaseLineRowActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function createPurchaseLineEditing(
  historyAdapter: PurchaseLineHistoryAdapter,
  createLineId: (productId: string) => string = (productId) => `${productId}-${Date.now()}`,
) {
  return {
    open(input: {
      product: SalesProduct;
      line?: PurchaseLine;
      matchedBarcode?: string;
    }): PurchaseLineEditingSession {
      const unit = input.line?.unit ?? defaultUnit(input.product, input.matchedBarcode);
      const initialDraft = input.line ? draftFromLine(input.line) : {
        unit,
        quantity: "",
        cost: input.product.batches[0]?.sellPriceThb
          ? String(input.product.batches[0].sellPriceThb)
          : "",
        includeFreeQuantity: false,
        freeQuantity: "",
        freeUnit: unit,
        lotNumber: "",
        expiryDate: "",
      };
      return Object.freeze({
        mode: input.line ? "edit" : "add",
        product: input.product,
        editingLineId: input.line?.id ?? null,
        draft: Object.freeze(initialDraft),
      });
    },

    change(
      session: PurchaseLineEditingSession,
      change: Partial<PurchaseLineEditorDraft>,
    ): PurchaseLineEditingSession {
      return changedSession(session, change);
    },

    inspect(
      session: PurchaseLineEditingSession,
      context: PurchaseLinePricingContext,
    ): PurchaseLineInspection {
      return {
        unitOptions: unitOptions(session.product),
        actualCost: calculateActualCost(session, context),
        expiryValid: isPurchaseExpiryDate(session.draft.expiryDate),
        canCommit: isValidDraft(session),
      };
    },

    commit(
      session: PurchaseLineEditingSession,
      context: PurchaseLinePricingContext,
    ): PurchaseLineCommitResult {
      if (!isValidDraft(session)) return { kind: "invalid" };
      const line: PurchaseLine = {
        id: session.editingLineId ?? createLineId(session.product.id),
        productId: session.product.id,
        barcode: session.product.barcode,
        imageUrl: session.product.imageUrl,
        itemName: session.product.itemName,
        unit: session.draft.unit,
        unitMultiplier: unitMultiplier(session.product, session.draft.unit),
        qty: session.draft.quantity.trim(),
        cost: session.draft.cost.trim(),
        freeQty: session.draft.includeFreeQuantity ? session.draft.freeQuantity.trim() : "",
        freeUnit: session.draft.freeUnit,
        freeUnitMultiplier: unitMultiplier(session.product, session.draft.freeUnit),
        lotNo: session.draft.lotNumber.trim(),
        expiryDate: formatPurchaseExpiryDate(session.draft.expiryDate.trim()),
      };
      const lines = session.editingLineId
        ? context.lines.map((existing) => existing.id === session.editingLineId ? line : existing)
        : [...context.lines, line];
      return { kind: "committed", line, lines };
    },

    keyboardAction(key: string, field: string | undefined): "submit" | "advance" | "ignore" {
      if (key !== "Enter") return "ignore";
      return field === "expiry" ? "submit" : "advance";
    },

    async loadHistory(
      session: PurchaseLineEditingSession,
      signal?: AbortSignal,
    ): Promise<PurchaseLineHistoryResult> {
      try {
        const line = await historyAdapter.loadLatest(session.product.id, signal);
        if (!line) return { kind: "empty" };
        return { kind: "loaded", line, actualCost: recordedActualCost(line) };
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
          return { kind: "cancelled" };
        }
        return {
          kind: "failed",
          message: error instanceof Error ? error.message : "Unable to load purchase history.",
        };
      }
    },
  };
}

export type PurchaseLineEditing = ReturnType<typeof createPurchaseLineEditing>;
