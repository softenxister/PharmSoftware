import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductDescription,
  calculateSalePricing,
  createReminderFromDefaultDosage,
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
