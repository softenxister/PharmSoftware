import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@/server/db/types";
import {
  invalidateStockCatalog,
  loadStockPage,
  loadStockProductsByIds,
  searchStockCatalog,
} from "./stockCatalogClient";

const product: SalesProduct = {
  id: "p-test",
  itemName: "Test product",
  brandName: "Test",
  manufacturerName: "Test manufacturer",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "1234567890123",
  category: "Test",
  imageUrl: "",
  weeklySold: 1,
  batches: [],
};

test("concurrent stock page loads share one bounded request and cache the result", async () => {
  invalidateStockCatalog();
  let requestCount = 0;
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestCount += 1;
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      products: [product],
      page: 1,
      pageSize: 50,
      total: 1,
      hasMore: false,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const [first, second] = await Promise.all([
    loadStockPage({}, fetcher),
    loadStockPage({}, fetcher),
  ]);
  const third = await loadStockPage({}, fetcher);

  assert.equal(requestCount, 1);
  assert.equal(requestedUrl, "/api/stock?page=1&pageSize=50&sort=name");
  assert.deepEqual(first.products, [product]);
  assert.strictEqual(first, second);
  assert.strictEqual(first, third);
});

test("searches are bounded, query-specific, and invalidated together", async () => {
  invalidateStockCatalog();
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({
      products: [product],
      page: 1,
      pageSize: 20,
      total: 1,
      hasMore: false,
    }), { status: 200 });
  };

  assert.deepEqual(await searchStockCatalog(" para ", fetcher), [product]);
  assert.deepEqual(await searchStockCatalog("para", fetcher), [product]);
  assert.equal(requestedUrls.length, 1);
  assert.equal(requestedUrls[0], "/api/stock?page=1&pageSize=20&sort=weekly&q=para");

  invalidateStockCatalog();
  assert.deepEqual(await searchStockCatalog("para", fetcher), [product]);
  assert.equal(requestedUrls.length, 2);
});

test("product id hydration deduplicates ids and never requests an unbounded catalog", async () => {
  invalidateStockCatalog();
  let requestCount = 0;
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestCount += 1;
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      products: [product],
      page: 1,
      pageSize: 2,
      total: 1,
      hasMore: false,
    }), { status: 200 });
  };

  assert.deepEqual(await loadStockProductsByIds(["p-test", "p-test", "p-other"], fetcher), [product]);
  assert.equal(requestCount, 1);
  assert.equal(requestedUrl, "/api/stock?page=1&pageSize=2&sort=name&ids=p-test%2Cp-other");
});

test("stock page loads request descending item-name order", async () => {
  invalidateStockCatalog();
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      products: [product],
      page: 1,
      pageSize: 50,
      total: 1,
      hasMore: false,
    }), { status: 200 });
  };

  await loadStockPage({ sort: "name", sortDirection: "desc" }, fetcher);

  assert.equal(requestedUrl, "/api/stock?page=1&pageSize=50&sort=name&direction=desc");
});
