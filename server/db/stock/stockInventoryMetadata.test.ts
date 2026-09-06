import assert from "node:assert/strict";
import test from "node:test";
import { parseStockReadQuery } from "./stockReadQuery";
import { stockInventoryMetadataSql } from "./stockInventoryMetadata";

test("inventory metadata aggregates the complete filtered result without page limits", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1&q=para&manufacturer=GPO"
      + "&legalCategory=%E0%B8%A2%E0%B8%B2%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%A2"
      + "&dosageType=Capsule&stockLevel=Low+Stock&stockMin=2&page=4&pageSize=10",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /filtered_products AS/i);
  assert.match(query.text, /product\."dosageForm" AS "dosageType"/i);
  assert.match(query.text, /LOWER\(product\."dosageForm"\) IN/i);
  assert.doesNotMatch(query.text, /product\."childUnit" AS "dosageType"/i);
  assert.match(query.text, /ARRAY_AGG\(DISTINCT filtered_products\."dosageType"/i);
  assert.match(query.text, /NOT IN \('Not Applicable', 'Unclassified'\)/i);
  assert.match(query.text, /legal_category_facets AS/i);
  assert.match(query.text, /ARRAY_AGG\(DISTINCT BTRIM\(product\."legalCategory"\)\)/i);
  assert.match(query.text, /COUNT\(\*\) FILTER \(\s*WHERE filtered_products\."totalStock"/i);
  assert.match(query.text, /"totalStock"\s*<\s*filtered_products\."minimumStock"/i);
  assert.match(query.text, /"totalStock"\s*>\s*filtered_products\."maximumStock"/i);
  assert.doesNotMatch(query.text, /\bLIMIT\b|\bOFFSET\b/i);
  assert.doesNotMatch(query.text, /para|GPO/i);
  assert.ok(query.values.includes("%para%"));
  assert.ok(query.values.includes("gpo"));
  assert.ok(query.values.includes("ยาอันตราย"));
  assert.ok(query.values.includes("capsule"));
});

test("sidebar metadata pre-aggregates stock batches once for every filter", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1"
      + "&stockLevel=Low+Stock&expiry=Within+30+days",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /stock_totals AS/i);
  assert.equal(
    query.text.match(/FROM "ProductBatch"/g)?.length,
    1,
  );
  assert.doesNotMatch(query.text, /LEFT JOIN "ProductBatch" batch/);
  assert.doesNotMatch(query.text, /\bHAVING\b/i);
});

test("missing-value filters combine selected checks with OR conditions", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1"
      + "&missing=category&missing=price&missing=measurement&missing=barcode",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /product\."categoryId" IS NULL/i);
  assert.match(query.text, /NOT EXISTS[\s\S]*priced_batch\."sellPriceThb" > 0/i);
  assert.match(query.text, /product\."childQuantity" <= 0/i);
  assert.match(query.text, /product\."packUnit"/i);
  assert.match(query.text, /product\."childUnit"/i);
  assert.match(query.text, /product\.barcode LIKE 'PHARM-%'/i);
  assert.match(query.text, /categoryId[\s\S]+ OR [\s\S]+sellPriceThb[\s\S]+ OR [\s\S]+childQuantity[\s\S]+ OR [\s\S]+barcode LIKE/i);
});

test("legal-category facet keeps alternative options after a legal category is selected", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1"
      + "&legalCategory=%E0%B8%A2%E0%B8%B2%E0%B8%AD%E0%B8%B1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%A2",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /legal_category_facets AS/i);
  assert.equal(
    query.text.match(/LOWER\(BTRIM\(product\."legalCategory"\)\) IN/gi)?.length,
    1,
  );
  assert.equal(
    query.values.filter((value) => value === "ยาอันตราย").length,
    1,
  );
});

test("ข.ย. 11 filtering requires bottle and ml units in addition to a regulated ingredient", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1"
      + "&regulatoryForm=%E0%B8%82.%E0%B8%A2.+11",
  );

  const query = stockInventoryMetadataSql(input);

  assert.doesNotMatch(query.text, /product\."legalCategory"\) = 'ยาอันตราย'/);
  assert.match(query.text, /FROM "ProductIngredient" product_ingredient/);
  assert.match(query.text, /FROM "ProductImportedIngredient" product_ingredient/);
  assert.match(query.text, /ingredient\."normalizedName"/);
  assert.match(query.text, /ingredient\."thaiName"/);
  assert.match(query.text, /atomic_name\."canonicalName"/);
  assert.match(query.text, /ILIKE ANY/i);
  assert.match(query.text, /\(and|และ\)/);
  assert.match(query.text, /LOWER\(BTRIM\(product\."packUnit"\)\) = 'bottle'/);
  assert.match(query.text, /LOWER\(BTRIM\(product\."childUnit"\)\) = 'ml'/);
  assert.ok(query.values.includes("%dextromethorphan%"));
  assert.ok(query.values.includes("%chlorpheniramine%"));
  assert.ok(query.values.includes("%sildenafil%"));
  assert.ok(query.values.includes("%dexamethasone%"));
  assert.ok(query.values.includes("%desoxymethasone%"));
  assert.equal(
    query.values.filter((value) => value === "%dextromethorphan%").length,
    2,
  );
});

test("ข.ย. 10 filtering follows specially controlled legal status", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?regulatoryForm=%E0%B8%82.%E0%B8%A2.+10",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /product\."legalCategory"\) = 'ยาควบคุมพิเศษ'/);
  assert.doesNotMatch(query.text, /FROM "ProductIngredient" product_ingredient/);
});
