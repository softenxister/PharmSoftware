import assert from "node:assert/strict";
import test from "node:test";
import {
  submitCustomerPurchaseHistoryMigration,
  submitProductCategoryNormalization,
  submitLotExpiryMigration,
  submitProductMeasurementNormalization,
} from "./migration/migrationClient";

test("customer purchase-history migration posts XLSX preview and import data to its endpoint", async () => {
  let requestedUrl = "";
  let requestedBody: FormData | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = init?.body as FormData;
    return new Response(JSON.stringify({ data: { importedCount: 4 } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  const file = new File(["xlsx"], "Rep_CustBuy_Det.xlsx");

  const result = await submitCustomerPurchaseHistoryMigration<{ importedCount: number }>(
    "import",
    file,
    "c".repeat(64),
    fetcher,
  );

  assert.equal(requestedUrl, "/api/stock/migrations/customer-purchases");
  assert.equal(requestedBody?.get("action"), "import");
  assert.equal(requestedBody?.get("file"), file);
  assert.equal(requestedBody?.get("confirmationToken"), "c".repeat(64));
  assert.deepEqual(result, { importedCount: 4 });
});

test("lot and expiry migration posts the XLSX and confirmation to its endpoint", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  let requestedBody: FormData | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? "";
    requestedBody = init?.body as FormData;
    return new Response(JSON.stringify({ data: { replacedProductCount: 1 } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  const file = new File(["xlsx"], "StockBal_MfgExp.xlsx");

  const result = await submitLotExpiryMigration<{ replacedProductCount: number }>(
    "import",
    file,
    "a".repeat(64),
    fetcher,
  );

  assert.equal(requestedUrl, "/api/stock/migrations/lots");
  assert.equal(requestedMethod, "POST");
  assert.equal(requestedBody?.get("action"), "import");
  assert.equal(requestedBody?.get("file"), file);
  assert.equal(requestedBody?.get("confirmationToken"), "a".repeat(64));
  assert.deepEqual(result, { replacedProductCount: 1 });
});

test("lot and expiry migration reports when the API server is unavailable", async () => {
  const fetcher: typeof fetch = async () => new Response("Bad Gateway", {
    status: 502,
    headers: { "Content-Type": "text/plain" },
  });

  await assert.rejects(
    submitLotExpiryMigration(
      "preview",
      new File(["xlsx"], "StockBal_MfgExp.xlsx"),
      undefined,
      fetcher,
    ),
    /API server is unavailable/i,
  );
});

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
