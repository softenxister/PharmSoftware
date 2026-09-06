import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseStockReadQuery } from "./stockReadQuery";
import { requiresAggregateStockRead } from "./stockCatalogRepository";

test("simple catalog filters avoid the aggregate stock query", () => {
  for (const query of [
    "legalCategory=ยาอันตราย",
    "manufacturer=GPO",
    "dosageType=Tablet",
    "tag=ยา",
  ]) {
    const input = parseStockReadQuery(`http://pharm.test/api/stock?${query}`);
    assert.equal(requiresAggregateStockRead(input), false, query);
  }
});

test("stock-derived filters still use the aggregate stock query", () => {
  for (const query of [
    "stockLevel=Low+Stock",
    "expiry=Within+30+days",
    "stockMin=1",
    "regulatoryForm=ข.ย.+11",
    "missing=price",
  ]) {
    const input = parseStockReadQuery(`http://pharm.test/api/stock?${query}`);
    assert.equal(requiresAggregateStockRead(input), true, query);
  }
});

test("the aggregate query only reads the recent sales week for weekly sorting", () => {
  const source = readFileSync(new URL("./stockCatalogRepository.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /const weekRange = input\.sort === "weekly"\s*\? await readRecentSalesWeekRange\(\)\s*:\s*null/,
  );
});

test("product graph hydration and derived metrics run concurrently after IDs are known", () => {
  const source = readFileSync(new URL("./stockCatalogRepository.ts", import.meta.url), "utf8");

  assert.match(source, /const \[rows, metrics\] = await Promise\.all\(/);
  assert.match(
    source,
    /readStockProductMetrics\(filtered\.ids, filtered\.weeklySoldByProductId\)/,
  );
  assert.match(source, /readStockProductMetrics\(productIds\)/);
});
