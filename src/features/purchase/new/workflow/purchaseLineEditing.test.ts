import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  createPurchaseLineEditing,
  isPurchaseLineRowActivationKey,
  purchaseLineUnitDisplayValue,
  type PurchaseLineHistoryAdapter,
  type PurchaseLineHistoryEntry,
  type PurchaseLinePricingContext,
} from "./purchaseLineEditing";
import { createHttpPurchaseLineHistoryAdapter } from "./purchaseLineHistoryAdapter";
import type { PurchaseLine } from "./purchaseDraft";

const product: SalesProduct = {
  id: "product-1",
  itemName: "Paracetamol 500 mg",
  brandName: "Sara",
  manufacturerName: "Thai Pharma",
  pack: { packUnit: "Blister", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [{
    id: "pack-box",
    packUnit: "Box",
    childPackUnit: "Blister",
    childPackQuantity: 10,
    label: "10 blisters",
    priceMultiplier: 10,
    barcodes: ["8850000000002"],
  }],
  location: "A1",
  barcode: "8850000000001",
  category: "Medicine",
  dosageForm: "Tablet",
  imageUrl: "/product.png",
  weeklySold: 1,
  batches: [{ batchNo: "LOT-1", expiryDate: "2028-01-31", sellPriceThb: 125.5, availableStock: 20 }],
};

const existingLine: PurchaseLine = {
  id: "line-1",
  productId: product.id,
  barcode: product.barcode,
  imageUrl: product.imageUrl,
  itemName: product.itemName,
  unit: "Box[10]",
  unitMultiplier: 10,
  qty: "4",
  cost: "125.50",
  freeQty: "1",
  freeUnit: "Box[10]",
  freeUnitMultiplier: 10,
  lotNo: "LOT-2026",
  expiryDate: "31-12-27",
};

const pricing = (lines: PurchaseLine[] = []): PurchaseLinePricingContext => ({
  lines,
  vatIncluded: true,
  discount: "0",
  discountType: "percent",
  discountTiming: "beforeVat",
});

const emptyHistory: PurchaseLineHistoryAdapter = { loadLatest: async () => null };

test("opening a scanned Purchase Line owns pack selection and initial draft defaults", () => {
  const editing = createPurchaseLineEditing(emptyHistory, () => "line-new");
  const session = editing.open({ product, matchedBarcode: "8850000000002" });

  assert.equal(session.mode, "add");
  assert.deepEqual(session.draft, {
    unit: "Box[10]",
    quantity: "",
    cost: "125.5",
    includeFreeQuantity: false,
    freeQuantity: "",
    freeUnit: "Box[10]",
    lotNumber: "",
    expiryDate: "",
  });
  assert.deepEqual(editing.inspect(session, pricing()).unitOptions, ["Blister[1]", "Box[10]"]);
});

test("reopening a Purchase Line restores the complete saved edit session", () => {
  const editing = createPurchaseLineEditing(emptyHistory);
  const session = editing.open({ product, line: existingLine });

  assert.equal(session.mode, "edit");
  assert.equal(session.editingLineId, existingLine.id);
  assert.deepEqual(session.draft, {
    unit: "Box[10]",
    quantity: "4",
    cost: "125.50",
    includeFreeQuantity: true,
    freeQuantity: "1",
    freeUnit: "Box[10]",
    lotNumber: "LOT-2026",
    expiryDate: "31-12-27",
  });
});

test("inspection coordinates free quantity validity, expiry, and actual cost", () => {
  const editing = createPurchaseLineEditing(emptyHistory);
  let session = editing.open({ product });
  session = editing.change(session, {
    quantity: "10",
    cost: "100",
    includeFreeQuantity: true,
    freeQuantity: "2",
    expiryDate: "311227",
  });

  assert.equal(session.draft.expiryDate, "31-12-27");
  assert.deepEqual(editing.inspect(session, {
    ...pricing(),
    discount: "10",
  }), {
    unitOptions: ["Blister[1]", "Box[10]"],
    actualCost: {
      baseCost: 83.33,
      discountPerUnit: 8.33,
      vatPerUnit: 0,
      actualCost: 75,
    },
    expiryValid: true,
    canCommit: true,
  });

  session = editing.change(session, { freeQuantity: "" });
  assert.equal(editing.inspect(session, pricing()).canCommit, false);
});

test("actual cost stays correct across VAT timing and mixed free-unit packs", () => {
  const editing = createPurchaseLineEditing(emptyHistory);
  let session = editing.open({ product });
  session = editing.change(session, { quantity: "2", cost: "100", expiryDate: "31-12-27" });

  assert.deepEqual(editing.inspect(session, {
    ...pricing(),
    vatIncluded: false,
    discount: "20",
    discountType: "thb",
    discountTiming: "beforeVat",
  }).actualCost, {
    baseCost: 100,
    discountPerUnit: 10,
    vatPerUnit: 6.3,
    actualCost: 96.3,
  });
  assert.deepEqual(editing.inspect(session, {
    ...pricing(),
    vatIncluded: false,
    discount: "20",
    discountType: "thb",
    discountTiming: "afterVat",
  }).actualCost, {
    baseCost: 100,
    discountPerUnit: 10,
    vatPerUnit: 7,
    actualCost: 97,
  });

  session = editing.change(session, {
    unit: "Box[10]",
    quantity: "2",
    cost: "500",
    includeFreeQuantity: true,
    freeQuantity: "10",
    freeUnit: "Blister[1]",
  });
  assert.deepEqual(editing.inspect(session, pricing()).actualCost, {
    baseCost: 333.33,
    discountPerUnit: 0,
    vatPerUnit: 0,
    actualCost: 333.33,
  });
});

test("commit appends new lines and replaces edited lines without changing identity", () => {
  const editing = createPurchaseLineEditing(emptyHistory, () => "line-new");
  let added = editing.open({ product });
  added = editing.change(added, { quantity: "2", cost: "100", expiryDate: "31-12-27" });
  const addResult = editing.commit(added, pricing([existingLine]));
  assert.equal(addResult.kind, "committed");
  if (addResult.kind !== "committed") throw new Error("Line was not committed.");
  assert.deepEqual(addResult.lines.map((line) => line.id), ["line-1", "line-new"]);

  let edited = editing.open({ product, line: existingLine });
  edited = editing.change(edited, { quantity: "6", lotNumber: " LOT-UPDATED " });
  const editResult = editing.commit(edited, pricing([existingLine]));
  assert.equal(editResult.kind, "committed");
  if (editResult.kind !== "committed") throw new Error("Line was not committed.");
  assert.equal(editResult.lines.length, 1);
  assert.equal(editResult.line.id, existingLine.id);
  assert.equal(editResult.line.qty, "6");
  assert.equal(editResult.line.lotNo, "LOT-UPDATED");
});

test("invalid Purchase Lines return an explicit outcome and never mutate bill lines", () => {
  const editing = createPurchaseLineEditing(emptyHistory);
  const session = editing.open({ product });

  assert.deepEqual(editing.commit(session, pricing([existingLine])), { kind: "invalid" });
});

test("history loading maps the adapter result and effective cost through the same interface", async () => {
  const historyLine: PurchaseLineHistoryEntry = {
    id: "history-1",
    productId: product.id,
    purchaseBillId: "purchase-1",
    billNo: "PO-1",
    date: "2026-08-01T10:00:00.000Z",
    distributor: "Distributor",
    unit: "Box[10]",
    unitMultiplier: 10,
    quantity: 10,
    cost: 100,
    freeUnit: "Blister[1]",
    freeUnitMultiplier: 1,
    freeQuantity: 5,
    batchNo: "LOT-HISTORY",
    expiryDate: "2028-01-31",
  };
  const editing = createPurchaseLineEditing({ loadLatest: async () => historyLine });

  assert.deepEqual(await editing.loadHistory(editing.open({ product })), {
    kind: "loaded",
    line: historyLine,
    actualCost: 95.24,
  });
});

test("the production history adapter requests only the selected product", async () => {
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ latestLine: null });
  };
  const adapter = createHttpPurchaseLineHistoryAdapter(fetcher);

  assert.equal(await adapter.loadLatest("product/1"), null);
  assert.equal(requestedUrl, "/api/purchase?productId=product%2F1");
});

test("history failures become an explicit editor outcome", async () => {
  const editing = createPurchaseLineEditing({
    loadLatest: async () => { throw new Error("History unavailable"); },
  });

  assert.deepEqual(await editing.loadHistory(editing.open({ product })), {
    kind: "failed",
    message: "History unavailable",
  });
});

test("keyboard and row activation rules are local to Purchase Line editing", () => {
  const editing = createPurchaseLineEditing(emptyHistory);
  assert.equal(editing.keyboardAction("Enter", "expiry"), "submit");
  assert.equal(editing.keyboardAction("Enter", "cost"), "advance");
  assert.equal(editing.keyboardAction("Tab", "expiry"), "ignore");
  assert.equal(isPurchaseLineRowActivationKey("Enter"), true);
  assert.equal(isPurchaseLineRowActivationKey(" "), true);
  assert.equal(isPurchaseLineRowActivationKey("Escape"), false);
  assert.equal(purchaseLineUnitDisplayValue("Blister[1]"), "Blister");
});
