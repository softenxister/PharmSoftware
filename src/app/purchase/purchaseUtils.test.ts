import assert from "node:assert/strict";
import test from "node:test";
import {
  canSavePurchase,
  formatDateDisplay,
  formatExpiryDateInput,
  isValidExpiryDate,
} from "./purchaseUtils";

test("expiry date input inserts dd/mm/yyyy separators", () => {
  assert.equal(formatExpiryDateInput("3"), "3");
  assert.equal(formatExpiryDateInput("311"), "31/1");
  assert.equal(formatExpiryDateInput("31122"), "31/12/2");
  assert.equal(formatExpiryDateInput("31/12/2027"), "31/12/2027");
});

test("expiry date input converts a complete Buddhist year to Christian year", () => {
  assert.equal(formatExpiryDateInput("31/12/2569"), "31/12/2026");
});

test("stored ISO dates display as a full dd/mm/yyyy date", () => {
  assert.equal(formatDateDisplay("2027-01-31"), "31/01/2027");
});

test("expiry validation rejects impossible and incomplete dates", () => {
  assert.equal(isValidExpiryDate("29/02/2028"), true);
  assert.equal(isValidExpiryDate("29/02/2027"), false);
  assert.equal(isValidExpiryDate("31/04/2027"), false);
  assert.equal(isValidExpiryDate("31/12/27"), false);
});

test("purchase save is blocked for empty or invalid totals", () => {
  assert.equal(canSavePurchase(0, 100), false);
  assert.equal(canSavePurchase(1, 0), false);
  assert.equal(canSavePurchase(1, Number.NaN), false);
  assert.equal(canSavePurchase(1, 100), true);
});
