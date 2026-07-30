import assert from "node:assert/strict";
import test from "node:test";
import {
  canSavePurchase,
} from "./new/workflow/purchaseDraft";
import {
  formatPurchaseExpiryDate as formatDateDisplay,
  formatPurchaseExpiryInput as formatExpiryDateInput,
  isPurchaseExpiryDate as isValidExpiryDate,
  normalizeExpiryDate as toDatabaseExpiryDate,
} from "@/lib/expiryDate";

test("expiry date input inserts DD-MM-YY separators", () => {
  assert.equal(formatExpiryDateInput("3"), "3");
  assert.equal(formatExpiryDateInput("311"), "31-1");
  assert.equal(formatExpiryDateInput("31122"), "31-12-2");
  assert.equal(formatExpiryDateInput("31-12-29"), "31-12-29");
});

test("pasted full years convert to the short Christian-year display", () => {
  assert.equal(formatExpiryDateInput("31/12/2569"), "31-12-26");
  assert.equal(formatExpiryDateInput("2029-12-02"), "02-12-29");
});

test("stored ISO dates display as DD-MM-YY on purchase cards", () => {
  assert.equal(formatDateDisplay("2027-01-31"), "31-01-27");
});

test("purchase display dates convert to canonical database dates", () => {
  assert.equal(toDatabaseExpiryDate("31-01-27"), "2027-01-31");
  assert.equal(toDatabaseExpiryDate("02-12-29"), "2029-12-02");
});

test("expiry validation rejects impossible and incomplete dates", () => {
  assert.equal(isValidExpiryDate("29-02-28"), true);
  assert.equal(isValidExpiryDate("29-02-27"), false);
  assert.equal(isValidExpiryDate("31-04-27"), false);
  assert.equal(isValidExpiryDate("31-12-2"), false);
});

test("purchase save is blocked for empty or invalid totals", () => {
  assert.equal(canSavePurchase(0, 100), false);
  assert.equal(canSavePurchase(1, 0), false);
  assert.equal(canSavePurchase(1, Number.NaN), false);
  assert.equal(canSavePurchase(1, 100), true);
});
