import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  invalidateStockCatalog,
  loadStockPage,
  loadStockProductsByIds,
  refreshStockProductsByIds,
  saveStockProduct,
  searchStockCatalog,
  saveStockProductPhotoUrl,
  uploadStockProductPhoto,
  validateProductPhotoFile,
} from "./stockCatalogClient";
import type { StockItemInput } from "@server/db/types";

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

test("paid-sale stock refresh bypasses cached product quantities", async () => {
  invalidateStockCatalog();
  let availableStock = 119;
  let requestCount = 0;
  const fetcher: typeof fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({
      products: [{
        ...product,
        batches: [{
          batchNo: "LOT-1",
          expiryDate: "2031-03-13",
          sellPriceThb: 50,
          availableStock,
        }],
      }],
      page: 1,
      pageSize: 1,
      total: 1,
      hasMore: false,
    }), { status: 200 });
  };

  const beforeSale = await loadStockProductsByIds(["p-test"], fetcher);
  availableStock = 99;
  const cachedAfterSale = await loadStockProductsByIds(["p-test"], fetcher);
  const refreshedAfterSale = await refreshStockProductsByIds(["p-test"], fetcher);

  assert.equal(beforeSale[0]?.batches[0]?.availableStock, 119);
  assert.equal(cachedAfterSale[0]?.batches[0]?.availableStock, 119);
  assert.equal(refreshedAfterSale[0]?.batches[0]?.availableStock, 99);
  assert.equal(requestCount, 2);
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

test("stock page loads request each sortable inventory column", async () => {
  for (const sort of ["minimum", "maximum", "stock", "sellPrice"] as const) {
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

    await loadStockPage({ sort, sortDirection: "desc" }, fetcher);

    assert.equal(requestedUrl, `/api/stock?page=1&pageSize=50&sort=${sort}&direction=desc`);
  }
});

test("inventory filters request one server-filtered page instead of the complete catalog", async () => {
  invalidateStockCatalog();
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({
      products: [product],
      page: 1,
      pageSize: 50,
      total: 1,
      hasMore: false,
    }), { status: 200 });
  };

  const result = await loadStockPage({
    page: 1,
    pageSize: 50,
    sort: "name",
    sortDirection: "desc",
    filters: {
      categories: ["Cold, Cough, Allergy & Respiratory"],
      dosageTypes: ["tablet"],
      expiryWindows: ["Within 30 days"],
      manufacturers: ["GPO"],
      tags: ["Best seller"],
      stockLevels: ["Low Stock"],
      stockRange: { min: 5, max: 20 },
    },
  }, fetcher);

  assert.deepEqual(result.products, [product]);
  assert.deepEqual(requestedUrls, [
    "/api/stock?page=1&pageSize=50&sort=name&direction=desc"
      + "&category=Cold%2C+Cough%2C+Allergy+%26+Respiratory"
      + "&dosageType=tablet"
      + "&expiry=Within+30+days"
      + "&manufacturer=GPO"
      + "&tag=Best+seller"
      + "&stockLevel=Low+Stock"
      + "&stockMin=5"
      + "&stockMax=20",
  ]);
});

test("stock saves surface the API error instead of failing silently", async () => {
  const input: StockItemInput = {
    productId: "p-test",
    photoUrl: "https://cdn.example.com/not-an-image",
    barcode: "1234567890123",
    itemName: "Test product",
    lotNo: "",
    expiryDate: "",
    location: "A1",
    manufacturer: "Test manufacturer",
    sellPrice: "100",
    itemCategory: "Test",
    weightage: "10",
    unit: "box",
    subUnit: "tablet",
    brandName: "Test",
    packagingRows: [],
  };
  const fetcher: typeof fetch = async () => Response.json({
    error: "Barcode is already assigned to another item.",
  }, { status: 400 });

  await assert.rejects(
    () => saveStockProduct(input, fetcher),
    /Barcode is already assigned to another item/,
  );
});

test("stock saves return the updated product after a fast URL-text save", async () => {
  const input: StockItemInput = {
    productId: "p-test",
    photoUrl: "https://cdn.example.com/item.png",
    barcode: product.barcode,
    itemName: product.itemName,
    lotNo: "",
    expiryDate: "",
    location: product.location,
    manufacturer: product.manufacturerName,
    sellPrice: "100",
    itemCategory: product.category,
    weightage: "10",
    unit: "box",
    subUnit: "tablet",
    brandName: product.brandName,
    packagingRows: [],
  };
  let savedBody = "";
  const fetcher: typeof fetch = async (_url, init) => {
    savedBody = String(init?.body);
    return Response.json({
      product: {
        ...product,
        imageUrl: input.photoUrl,
      },
    });
  };

  const saved = await saveStockProduct(input, fetcher);

  assert.deepEqual(JSON.parse(savedBody), input);
  assert.equal(saved.imageUrl, input.photoUrl);
});

test("a photo URL-only edit uses the fast patch endpoint without downloading", async () => {
  let requestUrl = "";
  let requestMethod = "";
  let requestBody = "";
  const fetcher: typeof fetch = async (url, init) => {
    requestUrl = String(url);
    requestMethod = init?.method ?? "";
    requestBody = String(init?.body);
    return Response.json({
      result: {
        productId: "p-test",
        imageUrl: "https://images.example.com/new.jpg",
      },
    });
  };

  const result = await saveStockProductPhotoUrl(
    "p-test",
    "https://images.example.com/new.jpg",
    fetcher,
  );

  assert.equal(requestUrl, "/api/stock/photo-url");
  assert.equal(requestMethod, "PATCH");
  assert.deepEqual(JSON.parse(requestBody), {
    productId: "p-test",
    photoUrl: "https://images.example.com/new.jpg",
  });
  assert.deepEqual(result, {
    productId: "p-test",
    imageUrl: "https://images.example.com/new.jpg",
  });
});

test("a computer photo upload sends the raw file to the product photo endpoint", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "medicine.png", { type: "image/png" });
  let requestedUrl = "";
  let requestedMethod = "";
  let requestedContentType = "";
  let requestedBody: BodyInit | null | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    requestedUrl = String(url);
    requestedMethod = init?.method ?? "";
    requestedContentType = new Headers(init?.headers).get("content-type") ?? "";
    requestedBody = init?.body;
    return Response.json({
      result: {
        productId: "p-test",
        imageUrl: "/api/product-images/p-test?v=abc123",
      },
    });
  };

  const result = await uploadStockProductPhoto("p-test", file, fetcher);

  assert.equal(requestedUrl, "/api/stock/photos/p-test");
  assert.equal(requestedMethod, "PUT");
  assert.equal(requestedContentType, "image/png");
  assert.strictEqual(requestedBody, file);
  assert.deepEqual(result, {
    productId: "p-test",
    imageUrl: "/api/product-images/p-test?v=abc123",
  });
});

test("computer photo selection rejects unsupported, empty, and oversized files", () => {
  assert.equal(validateProductPhotoFile({ type: "image/png", size: 1_024 }), null);
  assert.match(validateProductPhotoFile({ type: "image/svg+xml", size: 1_024 }) ?? "", /PNG/i);
  assert.match(validateProductPhotoFile({ type: "image/png", size: 0 }) ?? "", /non-empty/i);
  assert.match(validateProductPhotoFile({ type: "image/png", size: 9 * 1024 * 1024 }) ?? "", /8 MiB/i);
});
