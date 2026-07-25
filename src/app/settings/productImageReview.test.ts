import assert from "node:assert/strict";
import test from "node:test";
import {
  braveImageSearchRunLimit,
  canRunBraveImageSearch,
  directProductImageRejection,
  evidenceRows,
  formatImageBytes,
  hasReviewDecision,
  PRODUCT_IMAGE_REVIEW_PAGE_SIZE,
  reviewQueuePageRequest,
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

test("caps a manual Brave run at 1000 eligible products", () => {
  assert.equal(braveImageSearchRunLimit(0), 0);
  assert.equal(braveImageSearchRunLimit(199), 199);
  assert.equal(braveImageSearchRunLimit(1_234), 1_000);
});

test("requires configured Brave search, eligible products, and an idle UI", () => {
  assert.equal(canRunBraveImageSearch({ configured: true, eligibleCount: 1 }, false), true);
  assert.equal(canRunBraveImageSearch({ configured: false, eligibleCount: 1 }, false), false);
  assert.equal(canRunBraveImageSearch({ configured: true, eligibleCount: 0 }, false), false);
  assert.equal(canRunBraveImageSearch({ configured: true, eligibleCount: 1 }, true), false);
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

test("creates a direct rejection without asking the reviewer for a reason", () => {
  assert.deepEqual(directProductImageRejection(), {
    reason: "Rejected during product image review.",
    leaveUnresolved: false,
  });
});

test("moves between bounded candidate queue pages instead of appending items", () => {
  assert.equal(PRODUCT_IMAGE_REVIEW_PAGE_SIZE, 8);
  assert.deepEqual(reviewQueuePageRequest("next", 0, [null], "cursor-page-2"), {
    pageIndex: 1,
    cursor: "cursor-page-2",
  });
  assert.deepEqual(reviewQueuePageRequest("previous", 1, [null, "cursor-page-2"], null), {
    pageIndex: 0,
    cursor: undefined,
  });
  assert.equal(reviewQueuePageRequest("previous", 0, [null], "cursor-page-2"), null);
  assert.equal(reviewQueuePageRequest("next", 1, [null, "cursor-page-2"], null), null);
});
