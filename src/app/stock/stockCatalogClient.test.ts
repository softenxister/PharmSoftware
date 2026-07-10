import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@/server/db/types";
import {
  invalidateStockCatalog,
  loadStockCatalog,
  updateStockCatalog,
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

test("concurrent catalog loads share one request and cache the result", async () => {
  invalidateStockCatalog();
  let requestCount = 0;
  const fetcher: typeof fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ products: [product] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const [first, second] = await Promise.all([
    loadStockCatalog(fetcher),
    loadStockCatalog(fetcher),
  ]);
  const third = await loadStockCatalog(fetcher);

  assert.equal(requestCount, 1);
  assert.deepEqual(first, [product]);
  assert.strictEqual(first, second);
  assert.strictEqual(first, third);
});

test("catalog updates and invalidation control subsequent reads", async () => {
  updateStockCatalog([product]);
  let requestCount = 0;
  const fetcher: typeof fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ products: [] }), { status: 200 });
  };

  assert.deepEqual(await loadStockCatalog(fetcher), [product]);
  invalidateStockCatalog();
  assert.deepEqual(await loadStockCatalog(fetcher), []);
  assert.equal(requestCount, 1);
});
