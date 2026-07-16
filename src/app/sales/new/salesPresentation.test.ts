import assert from "node:assert/strict";
import test from "node:test";
import { buildProductDescription, shouldUseSellPackDropdown } from "./salesPresentation";

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
