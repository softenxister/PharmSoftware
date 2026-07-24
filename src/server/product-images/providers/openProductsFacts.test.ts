import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpenProductsFactsUrl,
  createOpenProductsFactsProvider,
  parseOpenProductsFactsResponse,
} from "./openProductsFacts";

test("builds one all-product exact-barcode query with only required fields", () => {
  assert.equal(
    buildOpenProductsFactsUrl("04006381333931"),
    "https://world.openfoodfacts.org/api/v3/product/04006381333931?product_type=all&fields=code%2Cproduct_name%2Cbrands%2Cmanufacturer%2Cquantity%2Ccountries_codes%2Cimage_front_url",
  );
});

test("parses a reusable exact-barcode front image candidate", () => {
  const candidate = parseOpenProductsFactsResponse({
    status: "success",
    product: {
      code: "4006381333931",
      product_name: "Example tablets 10",
      brands: "Example",
      manufacturer: "Example Pharma",
      quantity: "10 tablets",
      countries_codes: ["en:thailand"],
      image_front_url: "https://images.openfoodfacts.org/images/products/400/638/133/3931/front_en.10.400.jpg",
    },
  }, "04006381333931");

  assert.deepEqual(candidate, {
    provider: "OPEN_PRODUCTS_FACTS",
    sourcePageUrl: "https://world.openfoodfacts.org/product/4006381333931",
    sourceImageUrl: "https://images.openfoodfacts.org/images/products/400/638/133/3931/front_en.10.full.jpg",
    sourceLicence: "CC BY-SA 3.0",
    matchMethod: "EXACT_GTIN",
    sourceIdentifierType: "GTIN",
    sourceIdentifierValue: "04006381333931",
    sourceProductName: "Example tablets 10",
    sourceBrand: "Example",
    sourceManufacturer: "Example Pharma",
    sourceMarket: "TH",
    sourcePackCount: "10",
  });
});

test("rejects malformed, missing-image, and identifier-conflicting provider data", () => {
  assert.equal(parseOpenProductsFactsResponse(null, "04006381333931"), null);
  assert.equal(parseOpenProductsFactsResponse({ status: "success", product: {} }, "04006381333931"), null);
  assert.equal(parseOpenProductsFactsResponse({
    status: "success",
    product: {
      code: "036000291452",
      image_front_url: "https://images.openfoodfacts.org/example.jpg",
    },
  }, "04006381333931"), null);
  assert.equal(parseOpenProductsFactsResponse({
    status: "success",
    product: {
      code: "4006381333931",
      image_front_url: "javascript:alert(1)",
    },
  }, "04006381333931"), null);
});

test("caches repeated exact-barcode reads to conserve the free provider", async () => {
  let calls = 0;
  const provider = createOpenProductsFactsProvider({
    minIntervalMs: 0,
    fetch: async () => {
      calls += 1;
      return Response.json({
        status: "success",
        product: {
          code: "4006381333931",
          image_front_url: "https://images.openfoodfacts.org/example.400.jpg",
        },
      });
    },
  });

  await provider.findByGtin("04006381333931");
  await provider.findByGtin("04006381333931");
  assert.equal(calls, 1);
});
