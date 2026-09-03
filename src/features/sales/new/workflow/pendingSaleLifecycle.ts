import {
  resolveConfiguredPaymentMethod,
  type StorePaymentMethod,
} from "@/config/preferences/storePosSettings";
import {
  OWNERS,
  PHARMACISTS,
  type AppliedDiscount,
  type CartLine,
  type CatalogItem,
  type Customer,
  type PurchaseMethod,
  type SaleWriteRequest,
  type SavedSale,
  type SalesApiResponse,
} from "./saleTypes";

export type PendingSaleDraft = {
  ownerId: string;
  paymentMethod: StorePaymentMethod;
  purchaseMethod: PurchaseMethod;
  billDate: string;
  pharmacistId: string;
  customer: Customer | null;
  lines: CartLine[];
  discount: AppliedDiscount | null;
};

export type PendingSaleSession = Readonly<{
  saleId: string;
  billNo: string;
  createdAt: string;
}>;

export type LoadedPendingSale = {
  sale: SavedSale;
  catalog: CatalogItem[];
};

export type PendingSaleAdapter = {
  load: (saleId: string) => Promise<LoadedPendingSale | null>;
  save: (request: SaleWriteRequest) => Promise<
    | { kind: "saved"; sale: NonNullable<SalesApiResponse["sale"]> }
    | { kind: "conflict"; message: string }
  >;
  delete: (saleId: string) => Promise<
    | { kind: "deleted" }
    | { kind: "conflict"; message: string }
  >;
};

export type PendingSaleOpenResult =
  | {
      kind: "opened";
      session: PendingSaleSession;
      draft: PendingSaleDraft;
      catalog: CatalogItem[];
    }
  | {
      kind: "unavailable";
      reason: "missing" | "load-failed";
      message: string;
    };

export type PendingSaleSaveResult =
  | {
      kind: "saved";
      session: PendingSaleSession;
      sale: NonNullable<SalesApiResponse["sale"]>;
    }
  | { kind: "conflict" | "failed"; message: string };

export type PendingSaleDeleteResult =
  | { kind: "deleted" }
  | { kind: "conflict" | "failed"; message: string };

type OpenPendingSaleInput = {
  saleId: string;
  customers: Customer[];
  enabledPaymentMethods: readonly StorePaymentMethod[];
};

type SavePendingSaleInput = {
  session: PendingSaleSession | null;
  draft: PendingSaleDraft;
  subtotal: number;
  netPayable: number;
};

function canonicalDraft(draft: PendingSaleDraft): string {
  return JSON.stringify({
    ownerId: draft.ownerId,
    paymentMethod: draft.paymentMethod,
    purchaseMethod: draft.purchaseMethod,
    billDate: draft.billDate,
    pharmacistId: draft.pharmacistId,
    customer: draft.customer ? {
      id: draft.customer.id,
      name: draft.customer.name,
      mobile: draft.customer.mobile,
      isMember: draft.customer.isMember,
    } : null,
    lines: draft.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      itemName: line.itemName,
      packLabel: line.packLabel,
      packMultiplier: line.packMultiplier,
      unitPrice: line.unitPrice,
      loc: line.loc,
      batchId: line.batch.batchId,
      batchNo: line.batch.batchNo,
      expiry: line.batch.exp,
      sellPrice: line.batch.sellPrice,
      quantity: line.qty,
    })),
    discount: draft.discount,
  });
}

function purchaseMethod(value: string): PurchaseMethod {
  return value === "delivery" ? "delivery" : "pickup";
}

function draftFromSavedSale(
  sale: SavedSale,
  customers: Customer[],
  enabledPaymentMethods: readonly StorePaymentMethod[],
): PendingSaleDraft {
  return {
    ownerId: sale.ownerId ?? OWNERS[0].id,
    paymentMethod: resolveConfiguredPaymentMethod(sale.paymentMethod, enabledPaymentMethods),
    purchaseMethod: purchaseMethod(sale.purchaseMethod),
    billDate: sale.billDate || sale.date.slice(0, 10),
    pharmacistId: sale.pharmacistId ?? PHARMACISTS[0].id,
    customer: customers.find(({ id }) => id === sale.customerId) ?? null,
    lines: sale.lines,
    discount: sale.discount,
  };
}

function pendingSaleRequest(input: SavePendingSaleInput): SaleWriteRequest {
  const { draft, session } = input;
  return {
    status: "pending",
    id: session?.saleId,
    billNo: session?.billNo,
    owner: {
      id: draft.ownerId,
      name: OWNERS.find(({ id }) => id === draft.ownerId)?.name ?? draft.ownerId,
    },
    pharmacist: {
      id: draft.pharmacistId,
      name: PHARMACISTS.find(({ id }) => id === draft.pharmacistId)?.name ?? draft.pharmacistId,
    },
    customer: draft.customer,
    paymentMethod: draft.paymentMethod,
    purchaseMethod: draft.purchaseMethod,
    billDate: draft.billDate,
    subtotal: input.subtotal,
    netPayable: input.netPayable,
    customerPaid: null,
    changeDue: 0,
    discount: draft.discount,
    lines: draft.lines,
  };
}

export function createPendingSaleLifecycle(adapter: PendingSaleAdapter) {
  const baselines = new WeakMap<PendingSaleSession, string>();

  const createSession = (
    sale: NonNullable<SalesApiResponse["sale"]>,
    draft: PendingSaleDraft,
  ): PendingSaleSession => {
    const session: PendingSaleSession = Object.freeze({
      saleId: sale.id,
      billNo: sale.billNo,
      createdAt: sale.date,
    });
    baselines.set(session, canonicalDraft(draft));
    return session;
  };

  return {
    async open(input: OpenPendingSaleInput): Promise<PendingSaleOpenResult> {
      try {
        const loaded = await adapter.load(input.saleId);
        if (!loaded || loaded.sale.status !== "pending") {
          return {
            kind: "unavailable",
            reason: "missing",
            message: "This Pending Sale is no longer available.",
          };
        }
        const draft = draftFromSavedSale(
          loaded.sale,
          input.customers,
          input.enabledPaymentMethods,
        );
        return {
          kind: "opened",
          session: createSession({
            id: loaded.sale.id,
            billNo: loaded.sale.billNo,
            date: loaded.sale.date,
            status: "pending",
          }, draft),
          draft,
          catalog: loaded.catalog,
        };
      } catch {
        return {
          kind: "unavailable",
          reason: "load-failed",
          message: "Unable to load this Pending Sale.",
        };
      }
    },

    hasMeaningfulChanges(session: PendingSaleSession, draft: PendingSaleDraft): boolean {
      const baseline = baselines.get(session);
      return baseline === undefined || baseline !== canonicalDraft(draft);
    },

    async save(input: SavePendingSaleInput): Promise<PendingSaleSaveResult> {
      try {
        const result = await adapter.save(pendingSaleRequest(input));
        if (result.kind === "conflict") return result;
        return {
          kind: "saved",
          sale: result.sale,
          session: createSession(result.sale, input.draft),
        };
      } catch (error) {
        return {
          kind: "failed",
          message: error instanceof Error ? error.message : "Unable to save this Pending Sale.",
        };
      }
    },

    async delete(session: PendingSaleSession): Promise<PendingSaleDeleteResult> {
      try {
        return await adapter.delete(session.saleId);
      } catch (error) {
        return {
          kind: "failed",
          message: error instanceof Error ? error.message : "Unable to delete this Pending Sale.",
        };
      }
    },
  };
}

export type PendingSaleLifecycle = ReturnType<typeof createPendingSaleLifecycle>;
