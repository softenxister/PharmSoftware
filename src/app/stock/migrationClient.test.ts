import assert from "node:assert/strict";
import test from "node:test";
import {
  submitProductCategoryNormalization,
  submitProductMeasurementNormalization,
} from "./migration/migrationClient";

test("product category normalization posts to the migration endpoint and returns its summary", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? "";
    return new Response(JSON.stringify({
      data: {
        evaluatedCount: 325,
        changedCount: 87,
        unchangedCount: 238,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await submitProductCategoryNormalization(fetcher);

  assert.equal(requestedUrl, "/api/stock/migrations/categories");
  assert.equal(requestedMethod, "POST");
  assert.deepEqual(result, {
    evaluatedCount: 325,
    changedCount: 87,
    unchangedCount: 238,
  });
});

test("product category normalization rejects an incomplete server summary", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    data: {
      evaluatedCount: 325,
      changedCount: 87,
    },
  }), { status: 200 });

  await assert.rejects(
    submitProductCategoryNormalization(fetcher),
    /response was incomplete/i,
  );
});

test("product measurement normalization posts to the migration endpoint and validates its summary", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? "";
    return new Response(JSON.stringify({
      data: {
        evaluatedCount: 12142,
        changedCount: 8353,
        unchangedCount: 3789,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await submitProductMeasurementNormalization(fetcher);

  assert.equal(requestedUrl, "/api/stock/migrations/measurements");
  assert.equal(requestedMethod, "POST");
  assert.deepEqual(result, {
    evaluatedCount: 12142,
    changedCount: 8353,
    unchangedCount: 3789,
  });
});
