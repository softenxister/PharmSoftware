import assert from "node:assert/strict";
import test from "node:test";
import { parseStockReadQuery } from "./stockReadQuery";

test("stock reads default to the first bounded page", () => {
  assert.deepEqual(parseStockReadQuery("http://pharm.test/api/stock"), {
    page: 1,
    pageSize: 50,
    query: "",
    sort: "name",
    productIds: [],
  });
});

test("stock read limits are clamped and search input is normalized", () => {
  assert.deepEqual(parseStockReadQuery(
    "http://pharm.test/api/stock?page=-2&pageSize=500&q=%20%20Paracetamol%20%20&sort=weekly",
  ), {
    page: 1,
    pageSize: 100,
    query: "Paracetamol",
    sort: "weekly",
    productIds: [],
  });
});

test("stock id hydration is deduplicated and bounded", () => {
  const ids = Array.from({ length: 120 }, (_, index) => `product-${index}`);
  const parsed = parseStockReadQuery(
    `http://pharm.test/api/stock?ids=${encodeURIComponent([ids[0], ids[0], ...ids].join(","))}`,
  );

  assert.equal(parsed.productIds.length, 100);
  assert.equal(parsed.productIds[0], "product-0");
  assert.equal(parsed.productIds[99], "product-99");
});
