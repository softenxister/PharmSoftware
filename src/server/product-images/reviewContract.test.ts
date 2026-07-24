import assert from "node:assert/strict";
import test from "node:test";
import {
  parseProductImageBatchInput,
  parseProductImageDecisionInput,
  parseProductImageReviewQuery,
} from "./reviewContract";

test("bounds and normalizes review query parameters", () => {
  assert.deepEqual(parseProductImageReviewQuery(new URL(
    "https://pharm.test/api/product-image-review?status=APPROVED&query=%20Tylenol%20&pageSize=500&cursor=candidate-1",
  )), {
    status: "APPROVED",
    query: "Tylenol",
    pageSize: 50,
    cursor: "candidate-1",
  });
  assert.equal(parseProductImageReviewQuery(new URL(
    "https://pharm.test/api/product-image-review?status=unknown",
  )).status, "PENDING");
});

test("requires a bounded reason for reject and unresolved decisions", () => {
  assert.deepEqual(parseProductImageDecisionInput({
    reason: " Wrong pack size ",
    leaveUnresolved: true,
  }), {
    reason: "Wrong pack size",
    leaveUnresolved: true,
  });
  assert.equal(parseProductImageDecisionInput({ reason: " " }), null);
  assert.equal(parseProductImageDecisionInput({ reason: "x".repeat(501) }), null);
});

test("accepts only bounded integer batch sizes", () => {
  assert.deepEqual(parseProductImageBatchInput({ batchSize: 25 }), { batchSize: 25 });
  assert.equal(parseProductImageBatchInput({ batchSize: 0 }), null);
  assert.equal(parseProductImageBatchInput({ batchSize: 51 }), null);
  assert.equal(parseProductImageBatchInput({ batchSize: 1.5 }), null);
});
