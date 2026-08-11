import assert from "node:assert/strict";
import test from "node:test";
import { parseStockReadQuery } from "./stockReadQuery";
import { stockInventoryMetadataSql } from "./stockInventoryMetadata";

test("inventory metadata aggregates the complete filtered result without page limits", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1&q=para&manufacturer=GPO"
      + "&stockLevel=Low+Stock&stockMin=2&page=4&pageSize=10",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /WITH filtered_products AS/i);
  assert.match(query.text, /ARRAY_AGG\(DISTINCT filtered_products\."dosageType"/i);
  assert.match(query.text, /COUNT\(\*\) FILTER \(\s*WHERE filtered_products\."totalStock"/i);
  assert.match(query.text, /"totalStock"\s*<\s*filtered_products\."minimumStock"/i);
  assert.match(query.text, /"totalStock"\s*>\s*filtered_products\."maximumStock"/i);
  assert.doesNotMatch(query.text, /\bLIMIT\b|\bOFFSET\b/i);
  assert.doesNotMatch(query.text, /para|GPO/i);
  assert.ok(query.values.includes("%para%"));
  assert.ok(query.values.includes("gpo"));
});

test("ข.ย. 11 filtering requires verified designated ingredients and liquid evidence when needed", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?inventory=1"
      + "&regulatoryForm=%E0%B8%82.%E0%B8%A2.+11",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /product\."legalCategory"\) = 'ยาอันตราย'/);
  assert.match(query.text, /product\."compositionStatus" = 'VERIFIED'/);
  assert.match(query.text, /FROM "ProductIngredient" product_ingredient/);
  assert.match(query.text, /LOWER\(BTRIM\(product\."childUnit"\)\) IN/);
  assert.ok(query.values.includes("%dextromethorphan%"));
  assert.ok(query.values.includes("%chlorpheniramine%"));
  assert.ok(query.values.includes("syrup"));
});

test("ข.ย. 10 filtering follows specially controlled legal status", () => {
  const input = parseStockReadQuery(
    "http://pharm.test/api/stock?regulatoryForm=%E0%B8%82.%E0%B8%A2.+10",
  );

  const query = stockInventoryMetadataSql(input);

  assert.match(query.text, /product\."legalCategory"\) = 'ยาควบคุมพิเศษ'/);
  assert.doesNotMatch(query.text, /FROM "ProductIngredient" product_ingredient/);
});
