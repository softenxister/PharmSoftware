import assert from "node:assert/strict";
import test from "node:test";
import {
  createPendingSaleLifecycle,
  type PendingSaleAdapter,
  type PendingSaleDraft,
} from "./pendingSaleLifecycle";
import type { SavedSale } from "./saleTypes";

const savedSale: SavedSale = {
  id: "sale-pending-1",
  billNo: "INV-001",
  date: "2026-09-03T10:00:00.000Z",
  customerName: "Anong",
  customerMobile: "0812345678",
  isMember: true,
  itemCount: 1,
  paymentMethod: "Cash",
  purchaseMethod: "pickup",
  netTotal: 25,
  status: "pending",
  ownerId: "o1",
  billDate: "2026-09-03",
  pharmacistId: "p1",
  customerId: "customer-1",
  lines: [{
    lineId: "line-1",
    itemId: "product-1",
    itemName: "Paracetamol",
    packLabel: "blister pack",
    packMultiplier: 1,
    unitPrice: 25,
    loc: "A1",
    batch: {
      batchId: "batch-1",
      batchNo: "B-1",
      exp: "2028-01-01",
      sellPrice: 25,
      stock: 20,
    },
    qty: 1,
  }],
  discount: null,
};

const customer = {
  id: "customer-1",
  name: "Anong",
  mobile: "0812345678",
  isMember: true,
  points: 120,
  membershipRank: "Silver",
  topItemIds: [],
  allergies: [],
};

function fakeAdapter(overrides: Partial<PendingSaleAdapter> = {}) {
  const savedRequests: Parameters<PendingSaleAdapter["save"]>[0][] = [];
  const deletedIds: string[] = [];
  const adapter: PendingSaleAdapter = {
    load: async () => ({ sale: savedSale, catalog: [] }),
    save: async (request) => {
      savedRequests.push(request);
      return {
        kind: "saved",
        sale: {
          id: request.id ?? savedSale.id,
          billNo: request.billNo ?? savedSale.billNo,
          date: savedSale.date,
          status: "pending",
        },
      };
    },
    delete: async (saleId) => {
      deletedIds.push(saleId);
      return { kind: "deleted" };
    },
    ...overrides,
  };
  return { adapter, savedRequests, deletedIds };
}

async function openedLifecycle(adapter: PendingSaleAdapter) {
  const lifecycle = createPendingSaleLifecycle(adapter);
  const result = await lifecycle.open({
    saleId: savedSale.id,
    customers: [customer],
    enabledPaymentMethods: ["Cash", "Bank transfer"],
  });
  assert.equal(result.kind, "opened");
  if (result.kind !== "opened") throw new Error("Pending Sale did not open.");
  return { lifecycle, result };
}

test("opening a Pending Sale returns one hydrated draft and a clean session", async () => {
  const { adapter } = fakeAdapter();
  const { lifecycle, result } = await openedLifecycle(adapter);

  assert.equal(result.session.saleId, savedSale.id);
  assert.equal(result.session.billNo, savedSale.billNo);
  assert.equal(result.draft.customer, customer);
  assert.equal(result.draft.paymentMethod, "Cash");
  assert.deepEqual(result.draft.lines, savedSale.lines);
  assert.equal(lifecycle.hasMeaningfulChanges(result.session, result.draft), false);
});

test("every persisted Pending Sale field participates in meaningful-change detection", async () => {
  const { adapter } = fakeAdapter();
  const { lifecycle, result } = await openedLifecycle(adapter);
  const changes: PendingSaleDraft[] = [
    { ...result.draft, ownerId: "o2" },
    { ...result.draft, paymentMethod: "Bank transfer" },
    { ...result.draft, purchaseMethod: "delivery" },
    { ...result.draft, billDate: "2026-09-04" },
    { ...result.draft, pharmacistId: "p2" },
    { ...result.draft, customer: null },
    { ...result.draft, lines: [{ ...result.draft.lines[0], qty: 2 }] },
    { ...result.draft, discount: { type: "thb", value: 5 } },
  ];

  for (const draft of changes) {
    assert.equal(lifecycle.hasMeaningfulChanges(result.session, draft), true);
  }
});

test("saving an opened Pending Sale updates the same durable identity", async () => {
  const { adapter, savedRequests } = fakeAdapter();
  const { lifecycle, result } = await openedLifecycle(adapter);
  const changedDraft = { ...result.draft, purchaseMethod: "delivery" as const };

  const saved = await lifecycle.save({
    session: result.session,
    draft: changedDraft,
    subtotal: 25,
    netPayable: 25,
  });

  assert.equal(saved.kind, "saved");
  assert.equal(savedRequests[0]?.id, savedSale.id);
  assert.equal(savedRequests[0]?.billNo, savedSale.billNo);
  assert.equal(savedRequests[0]?.status, "pending");
  assert.equal(savedRequests[0]?.purchaseMethod, "delivery");
  if (saved.kind !== "saved") throw new Error("Pending Sale was not saved.");
  assert.equal(lifecycle.hasMeaningfulChanges(saved.session, changedDraft), false);
});

test("saving a new Sale creates a clean Pending Sale session", async () => {
  const { adapter, savedRequests } = fakeAdapter();
  const lifecycle = createPendingSaleLifecycle(adapter);
  const draft: PendingSaleDraft = {
    ownerId: "o1",
    paymentMethod: "Cash",
    purchaseMethod: "pickup",
    billDate: "2026-09-03",
    pharmacistId: "p1",
    customer: null,
    lines: savedSale.lines,
    discount: null,
  };

  const result = await lifecycle.save({
    session: null,
    draft,
    subtotal: 25,
    netPayable: 25,
  });

  assert.equal(result.kind, "saved");
  assert.equal(savedRequests[0]?.id, undefined);
  assert.equal(savedRequests[0]?.billNo, undefined);
  if (result.kind !== "saved") throw new Error("Pending Sale was not saved.");
  assert.equal(lifecycle.hasMeaningfulChanges(result.session, draft), false);
});

test("missing records and adapter failures become explicit open outcomes", async () => {
  const missing = fakeAdapter({ load: async () => null });
  const missingLifecycle = createPendingSaleLifecycle(missing.adapter);
  assert.deepEqual(await missingLifecycle.open({
    saleId: "missing",
    customers: [],
    enabledPaymentMethods: ["Cash"],
  }), {
    kind: "unavailable",
    reason: "missing",
    message: "This Pending Sale is no longer available.",
  });

  const failed = fakeAdapter({ load: async () => { throw new Error("offline"); } });
  const failedLifecycle = createPendingSaleLifecycle(failed.adapter);
  assert.deepEqual(await failedLifecycle.open({
    saleId: "missing",
    customers: [],
    enabledPaymentMethods: ["Cash"],
  }), {
    kind: "unavailable",
    reason: "load-failed",
    message: "Unable to load this Pending Sale.",
  });
});

test("stale save and delete outcomes preserve the caller draft", async () => {
  const conflict = fakeAdapter({
    save: async () => ({ kind: "conflict", message: "This Pending Sale is no longer available." }),
    delete: async () => ({ kind: "conflict", message: "This Pending Sale is no longer available." }),
  });
  const { lifecycle, result } = await openedLifecycle(conflict.adapter);

  const saved = await lifecycle.save({
    session: result.session,
    draft: { ...result.draft, ownerId: "o2" },
    subtotal: 25,
    netPayable: 25,
  });
  const deleted = await lifecycle.delete(result.session);

  assert.deepEqual(saved, { kind: "conflict", message: "This Pending Sale is no longer available." });
  assert.deepEqual(deleted, { kind: "conflict", message: "This Pending Sale is no longer available." });
});

test("deleting a Pending Sale uses only its durable identity", async () => {
  const { adapter, deletedIds } = fakeAdapter();
  const { lifecycle, result } = await openedLifecycle(adapter);

  assert.deepEqual(await lifecycle.delete(result.session), { kind: "deleted" });
  assert.deepEqual(deletedIds, [savedSale.id]);
});
