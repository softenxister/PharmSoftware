import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductDescription,
  buildSellPackOptions,
  calculateSalePricing,
  createReminderFromDefaultDosage,
  resolvePaidSaleNextStep,
  shouldUseSellPackDropdown,
} from "./salesPresentation";

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
