import assert from "node:assert/strict";
import test from "node:test";
import {
  displayBatchField,
  nearestAvailableExpiryBatch,
} from "./batchPresentation";
import * as batchPresentation from "./batchPresentation";

test("null and blank batch values display as a hyphen", () => {
  assert.equal(displayBatchField(null), "-");
  assert.equal(displayBatchField(""), "-");
  assert.equal(displayBatchField("   "), "-");
  assert.equal(displayBatchField("LOT-100"), "LOT-100");
});

test("optional batch numbers normalize to a database null", () => {
  const normalizeOptionalBatchNo = (
    batchPresentation as unknown as {
      normalizeOptionalBatchNo?: (value: string | null | undefined) => string | null;
    }
  ).normalizeOptionalBatchNo;

  assert.equal(typeof normalizeOptionalBatchNo, "function");
  assert.equal(normalizeOptionalBatchNo?.(null), null);
  assert.equal(normalizeOptionalBatchNo?.(""), null);
  assert.equal(normalizeOptionalBatchNo?.("  LOT-100  "), "LOT-100");
});

test("nearest available expiry excludes blank dates when dated stock exists", () => {
  const batches = [
    { id: "undated", expiryDate: "", stock: 10 },
    { id: "later", expiryDate: "2028-03-01", stock: 10 },
    { id: "nearest", expiryDate: "01/02/2028", stock: 5 },
    { id: "out-of-stock", expiryDate: "2027-01-01", stock: 0 },
  ];

  assert.equal(
    nearestAvailableExpiryBatch(
      batches,
      (batch) => batch.expiryDate,
      (batch) => batch.stock,
    )?.id,
    "nearest",
  );
});

test("nearest available expiry falls back to an undated batch when it is the only stock", () => {
  const batches = [
    { id: "out-of-stock", expiryDate: "2028-01-01", stock: 0 },
    { id: "undated", expiryDate: " ", stock: 4 },
  ];

  assert.equal(
    nearestAvailableExpiryBatch(
      batches,
      (batch) => batch.expiryDate,
      (batch) => batch.stock,
    )?.id,
    "undated",
  );
});
