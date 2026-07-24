import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceRows,
  formatImageBytes,
  hasReviewDecision,
} from "./productImageReview";

test("turns untrusted evidence JSON into bounded display rows", () => {
  assert.deepEqual(evidenceRows({
    agreements: ["gtin", "brand"],
    missing: ["manufacturer"],
    conflicts: [],
  }), [
    { kind: "agreement", field: "gtin" },
    { kind: "agreement", field: "brand" },
    { kind: "missing", field: "manufacturer" },
  ]);
  assert.equal(evidenceRows({ agreements: ["x".repeat(200)] })[0].field.length, 80);
  assert.deepEqual(evidenceRows("<script>"), []);
});

test("formats image byte sizes compactly", () => {
  assert.equal(formatImageBytes(900), "900 B");
  assert.equal(formatImageBytes(1536), "1.5 KB");
  assert.equal(formatImageBytes(null), "—");
});

test("requires a selected pending candidate and idle state for decisions", () => {
  assert.equal(hasReviewDecision({ status: "PENDING" }, false), true);
  assert.equal(hasReviewDecision({ status: "APPROVED" }, false), false);
  assert.equal(hasReviewDecision({ status: "PENDING" }, true), false);
  assert.equal(hasReviewDecision(null, false), false);
});
