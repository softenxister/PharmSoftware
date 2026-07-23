import assert from "node:assert/strict";
import test from "node:test";
import { parseStockReadQuery } from "./stockReadQuery";

test("stock reads default to the first bounded page", () => {
  assert.deepEqual(parseStockReadQuery("http://pharm.test/api/stock"), {
    page: 1,
    pageSize: 50,
    query: "",
    sort: "name",
    sortDirection: "asc",
    productIds: [],
    filters: {
      categories: [],
      dosageTypes: [],
      expiryWindows: [],
      manufacturers: [],
      tags: [],
      stockLevels: [],
      stockRange: null,
    },
  });
});

test("stock reads accept descending item-name order", () => {
  assert.equal(
    parseStockReadQuery("http://pharm.test/api/stock?sort=name&direction=desc").sortDirection,
    "desc",
  );
});

test("stock read limits are clamped and search input is normalized", () => {
  assert.deepEqual(parseStockReadQuery(
    "http://pharm.test/api/stock?page=-2&pageSize=500&q=%20%20Paracetamol%20%20&sort=weekly",
  ), {
    page: 1,
    pageSize: 100,
    query: "Paracetamol",
    sort: "weekly",
    sortDirection: "asc",
    productIds: [],
    filters: {
      categories: [],
      dosageTypes: [],
      expiryWindows: [],
      manufacturers: [],
      tags: [],
      stockLevels: [],
      stockRange: null,
    },
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

test("stock reads parse bounded repeated inventory filters", () => {
  const parsed = parseStockReadQuery(
    "http://pharm.test/api/stock"
      + "?category=Pain+%26+Fever+Relief"
      + "&category=Gastrointestinal+Medicines"
      + "&dosageType=tablet"
      + "&expiry=Within+30+days"
      + "&manufacturer=GPO"
      + "&tag=Best+seller"
      + "&stockLevel=Low+Stock"
      + "&stockMin=5"
      + "&stockMax=20",
  );

  assert.deepEqual(parsed.filters, {
    categories: ["Pain & Fever Relief", "Gastrointestinal Medicines"],
    dosageTypes: ["tablet"],
    expiryWindows: ["Within 30 days"],
    manufacturers: ["GPO"],
    tags: ["Best seller"],
    stockLevels: ["Low Stock"],
    stockRange: { min: 5, max: 20 },
  });
});

test("stock reads discard invalid inventory filter values and ranges", () => {
  const parsed = parseStockReadQuery(
    "http://pharm.test/api/stock?expiry=Tomorrow&stockLevel=Nearly+empty&stockMin=-1&stockMax=none",
  );

  assert.deepEqual(parsed.filters.expiryWindows, []);
  assert.deepEqual(parsed.filters.stockLevels, []);
  assert.equal(parsed.filters.stockRange, null);
});

test("stock reads preserve a valid one-sided stock range", () => {
  assert.deepEqual(
    parseStockReadQuery("http://pharm.test/api/stock?stockMin=0").filters.stockRange,
    { min: 0, max: null },
  );
  assert.deepEqual(
    parseStockReadQuery("http://pharm.test/api/stock?stockMax=25").filters.stockRange,
    { min: null, max: 25 },
  );
});
