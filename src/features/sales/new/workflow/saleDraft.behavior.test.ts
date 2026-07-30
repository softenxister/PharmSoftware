import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateSaleQuantityAcrossBatches,
  buildProductDescription,
  buildSellPackOptions,
  calculateSalePricing,
  createReminderFromDefaultDosage,
  formatBatchExpiry,
  groupSaleLinesForDisplay,
  normalizeThaiKeyboardBarcodeInput,
  normalizeThaiKeyboardNumericInput,
  resolvePaidSaleNextStep,
  shouldUseSellPackDropdown,
  topWeeklyItemIds,
  totalAvailableSaleQuantity,
} from "./saleDraft";

test("batch expiry displays the full localized date in English and Thai", () => {
  assert.equal(formatBatchExpiry("en", "2031-06-04"), "04 JUN 2031");
  assert.equal(formatBatchExpiry("th", "2031-04-04"), "04 เม.ย. 2031");
});

test("Thai keyboard number-row output is normalized for barcode searches in every app language", () => {
  assert.equal(normalizeThaiKeyboardBarcodeInput("ๅ/-ภถุึคตจ"), "1234567890");
  assert.equal(normalizeThaiKeyboardBarcodeInput("คคถคึตึภๅจจๅ/"), "8858797410012");
  assert.equal(normalizeThaiKeyboardBarcodeInput("คคถุจต*จ*ภๅจต"), "8856093034109");
  assert.equal(normalizeThaiKeyboardBarcodeInput("คคถุจต_จ_ภๅจต"), "8856093034109");
  assert.equal(normalizeThaiKeyboardBarcodeInput("๙๘๗๖๕"), "98765");
});

test("Thai product names remain unchanged", () => {
  assert.equal(normalizeThaiKeyboardBarcodeInput("ถุงมือ"), "ถุงมือ");
  assert.equal(normalizeThaiKeyboardBarcodeInput("ยาแก้ไอ 5 ขวบ"), "ยาแก้ไอ 5 ขวบ");
});

test("weekly product rail contains only products with real sales and ranks the top ten", () => {
  const products = [
    { id: "never-sold", weeklySold: 0 },
    { id: "invalid", weeklySold: Number.NaN },
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `sold-${index + 1}`,
      weeklySold: index + 1,
    })),
  ];

  assert.deepEqual(
    topWeeklyItemIds(products),
    ["sold-11", "sold-10", "sold-9", "sold-8", "sold-7",
      "sold-6", "sold-5", "sold-4", "sold-3", "sold-2"],
  );
});

test("Thai keyboard number keys become visible digits in quantity input in every app language", () => {
  assert.equal(normalizeThaiKeyboardNumericInput("ภถุ"), "456");
  assert.equal(normalizeThaiKeyboardNumericInput("๔๕๖"), "456");
  assert.equal(normalizeThaiKeyboardNumericInput("1ภ"), "14");
});

test("sale quantity is allocated across dated and blank batches", () => {
  const batches = [
    { id: "blank", stock: 10 },
    { id: "dated", stock: 3 },
  ];

  assert.equal(totalAvailableSaleQuantity(batches, (batch) => batch.stock), 13);
  assert.deepEqual(
    allocateSaleQuantityAcrossBatches(batches, batches[1], 13, (batch) => batch.stock),
    [
      { batch: batches[1], quantity: 3 },
      { batch: batches[0], quantity: 10 },
    ],
  );
});

test("sale quantity allocation never exceeds available stock", () => {
  const batches = [
    { id: "blank", stock: 10 },
    { id: "dated", stock: 3 },
  ];

  assert.deepEqual(
    allocateSaleQuantityAcrossBatches(batches, batches[1], 20, (batch) => batch.stock),
    [
      { batch: batches[1], quantity: 3 },
      { batch: batches[0], quantity: 10 },
    ],
  );
});

test("batch-split cart stock displays as one row using the earliest dated batch", () => {
  const lines = [
    { itemId: "p-1", pack: "piece", batchNo: "", expiry: "", qty: 10 },
    { itemId: "p-1", pack: "piece", batchNo: "LATE", expiry: "2031-06-04", qty: 2 },
    { itemId: "p-1", pack: "piece", batchNo: "EARLY", expiry: "2030-04-04", qty: 1 },
  ];

  assert.deepEqual(
    groupSaleLinesForDisplay(
      lines,
      (line) => `${line.itemId}|${line.pack}`,
      (line) => line.qty,
      (line) => line.expiry,
    ),
    [{
      key: "p-1|piece",
      lines,
      representative: lines[2],
      quantity: 13,
    }],
  );
});

test("a blank batch displays when it is the only batch for the item", () => {
  const lines = [
    { itemId: "p-1", pack: "piece", batchNo: "", expiry: "", qty: 10 },
  ];

  assert.equal(
    groupSaleLinesForDisplay(
      lines,
      (line) => `${line.itemId}|${line.pack}`,
      (line) => line.qty,
      (line) => line.expiry,
    )[0]?.representative,
    lines[0],
  );
});

test("stock is appended to product details instead of displayed below price", () => {
  assert.equal(buildProductDescription({
    brand: "Nexcare",
    packLabel: "4 pieces",
    location: "A-04",
    totalStock: 110,
    showLocation: false,
    showStock: true,
  }), "Nexcare - 4 pieces - 110 stock");
});

test("product location appears only when the owner enables it", () => {
  assert.equal(buildProductDescription({
    brand: "Nexcare",
    packLabel: "4 pieces",
    location: "A-04",
    totalStock: 110,
    showLocation: true,
    showStock: false,
  }), "Nexcare - 4 pieces - A-04");
  assert.equal(buildProductDescription({
    brand: "Nexcare",
    packLabel: "4 pieces",
    location: "",
    totalStock: 0,
    showLocation: true,
    showStock: true,
  }), "Nexcare - 4 pieces - 0 stock");
});

test("sell-pack selection becomes a dropdown only when multiple packages exist", () => {
  assert.equal(shouldUseSellPackDropdown(0), false);
  assert.equal(shouldUseSellPackDropdown(1), false);
  assert.equal(shouldUseSellPackDropdown(2), true);
});

test("same-unit package variants have distinct sales keys and quantity labels", () => {
  const options = buildSellPackOptions(
    { packUnit: "blisterpack", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
    [
      { packUnit: "box", childPackUnit: "blisterpack", childPackQuantity: 20, label: "1 box = 20 blisterpack", priceMultiplier: 20 },
      { packUnit: "box", childPackUnit: "blisterpack", childPackQuantity: 30, label: "1 box = 30 blisterpack", priceMultiplier: 30 },
    ],
  );

  assert.deepEqual(options.map(({ key, label }) => ({ key, label })), [
    { key: "base:blisterpack", label: "blister" },
    { key: "parent:box:blisterpack:20", label: "box(20)" },
    { key: "parent:box:blisterpack:30", label: "box(30)" },
  ]);
});

test("sell-pack options preserve imported barcodes and explicit prices", () => {
  const options = buildSellPackOptions(
    { packUnit: "blisterpack", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
    [{
      id: "pack-20",
      packUnit: "box",
      childPackUnit: "blisterpack",
      childPackQuantity: 20,
      label: "1 box = 20 blisterpack",
      priceMultiplier: 20,
      sellPriceThb: 185,
      barcodes: ["BOX-20", "BOX-20-ALT"],
    }],
    ["BASE-1", "BASE-2"],
  );

  assert.deepEqual(options.map(({ key, sellPriceThb, barcodes }) => ({ key, sellPriceThb, barcodes })), [
    { key: "base:blisterpack", sellPriceThb: undefined, barcodes: ["BASE-1", "BASE-2"] },
    { key: "pack-20", sellPriceThb: 185, barcodes: ["BOX-20", "BOX-20-ALT"] },
  ]);
});

test("item discounts apply before the bill discount", () => {
  assert.deepEqual(calculateSalePricing([
    { quantity: 2, unitPrice: 100, discountPercent: 10 },
    { quantity: 1, unitPrice: 50, discountPercent: 0 },
  ], { type: "percent", value: 10 }), {
    grossSubtotal: 250,
    itemDiscountAmount: 20,
    billDiscountAmount: 23,
    netPayable: 207,
  });
});

test("all-zero dosage starts unchecked and a saved dosage starts checked", () => {
  assert.deepEqual(createReminderFromDefaultDosage([0, 0, 0, 0]), {
    enabled: false,
    activeTime: 0,
    doses: [0, 0, 0, 0],
  });
  assert.deepEqual(createReminderFromDefaultDosage([1, 0, 2, 0]), {
    enabled: true,
    activeTime: 0,
    doses: [1, 0, 2, 0],
  });
});

test("paid sale submit shows the invoice preview and print opens the receipt route", () => {
  assert.deepEqual(resolvePaidSaleNextStep("submit", "sale/123"), { kind: "invoice-preview" });
  assert.deepEqual(resolvePaidSaleNextStep("print", "sale/123"), {
    kind: "receipt-route",
    path: "/sales/receipt/sale%2F123",
    resetOriginalSale: true,
    target: "new-tab",
  });
});
