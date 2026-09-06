import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  buildFilterOptions,
  clampStockSidebarWidth,
  createEmptyDraftFilters,
  parseStockRange,
  projectAuthoritativeInventoryPage,
  projectStockInventoryItem,
  reopenStockSidebarFromEdgeDrag,
  roundMarkupPercentForDisplay,
  resizeStockSidebarFromDrag,
} from "./stockInventoryModel";

const product: SalesProduct = {
  id: "product-1",
  createdAt: "2026-08-31T04:30:00.000Z",
  itemName: "Server-selected product",
  brandName: "Example",
  manufacturerName: "GPO",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "8850000000001",
  category: "Pain Relief",
  imageUrl: "",
  weeklySold: 0,
  minimumStock: 10,
  maximumStock: 50,
  averageCostThb: 30,
  genericName: "Paracetamol",
  legalCategory: "ยาอันตราย",
  dosageForm: "Tablet",
  batches: [{
    batchNo: "LOT-1",
    expiryDate: "2027-08-01",
    sellPriceThb: 45,
    availableStock: 8,
  }],
};

test("inventory renders the authoritative server page without filtering it again", () => {
  const inventory = {
    facets: {
      legalCategories: ["ยาอันตราย"],
      dosageTypes: ["capsule", "tablet"],
      manufacturers: ["GPO"],
      tags: ["Cold chain"],
    },
    counts: { lowStock: 38, overstock: 7 },
  };
  const page = projectAuthoritativeInventoryPage({
    products: [product],
    page: 3,
    pageSize: 50,
    total: 121,
    hasMore: false,
    inventory,
  });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].name, "Server-selected product");
  assert.equal(page.items[0].state, "low");
  assert.equal(page.items[0].markupPercent, 50);
  assert.equal(page.items[0].cost, 30);
  assert.equal(page.items[0].createdAt, "2026-08-31T04:30:00.000Z");
  assert.equal(page.page, 3);
  assert.equal(page.total, 121);
  assert.equal(page.hasMore, false);
  assert.deepEqual(page.inventory, inventory);
});

test("inventory projects dosage form independently from packaging unit", () => {
  const item = projectStockInventoryItem({
    ...product,
    dosageForm: "Capsule",
    pack: { ...product.pack, childUnit: "box" },
  });

  assert.equal(item.dosageType, "Capsule");
});

test("inventory markup display rounds fractional percentages up to whole numbers", () => {
  assert.equal(roundMarkupPercentForDisplay(12.01), 13);
  assert.equal(roundMarkupPercentForDisplay(12), 12);
  assert.equal(roundMarkupPercentForDisplay(-12.99), -12);
});

test("inventory displays a missing latest cost as zero", () => {
  const item = projectStockInventoryItem({ ...product, averageCostThb: undefined });

  assert.equal(item.cost, 0);
  assert.equal(item.markupPercent, undefined);
});

test("inventory option lists stay stable while adding server values", () => {
  assert.deepEqual(
    buildFilterOptions(["Tablet", "Capsule"], ["tablet", "Cream", " GPO "]),
    ["Tablet", "Capsule", "Cream", "GPO"],
  );
});

test("inventory drafts expose only filters backed by the authoritative server read", () => {
  assert.deepEqual(createEmptyDraftFilters(), {
    categories: [],
    legalCategories: [],
    dosageTypes: [],
    expiryWindows: [],
    stockLevels: [],
    regulatoryForms: [],
    missingValues: [],
    manufacturers: [],
    tags: [],
    minimumStock: "",
    maximumStock: "",
  });
});

test("stock range parsing accepts optional bounds and rejects invalid ranges", () => {
  assert.deepEqual(parseStockRange("", ""), { range: null, isValid: true });
  assert.deepEqual(
    parseStockRange("5", "20"),
    { range: { min: 5, max: 20 }, isValid: true },
  );
  assert.equal(parseStockRange("20", "5").isValid, false);
  assert.equal(parseStockRange("-1", "5").isValid, false);
  assert.equal(parseStockRange("five", "10").isValid, false);
});

test("inventory sidebar drag stops at its minimum and maximum widths", () => {
  assert.equal(clampStockSidebarWidth(100), 230);
  assert.equal(clampStockSidebarWidth(275), 275);
  assert.equal(clampStockSidebarWidth(500), 360);
});

test("dragging left past the minimum closes the inventory sidebar deliberately", () => {
  assert.deepEqual(resizeStockSidebarFromDrag(270, -40), {
    isClosed: false,
    width: 230,
  });
  assert.deepEqual(resizeStockSidebarFromDrag(270, -88), {
    isClosed: false,
    width: 230,
  });
  assert.deepEqual(resizeStockSidebarFromDrag(270, -150), {
    isClosed: true,
    width: 230,
  });
});

test("dragging right from the screen edge reopens the inventory sidebar", () => {
  assert.deepEqual(reopenStockSidebarFromEdgeDrag(109), {
    isClosed: true,
    width: 230,
  });
  assert.deepEqual(reopenStockSidebarFromEdgeDrag(110), {
    isClosed: false,
    width: 230,
  });
  assert.deepEqual(reopenStockSidebarFromEdgeDrag(160), {
    isClosed: false,
    width: 280,
  });
});
