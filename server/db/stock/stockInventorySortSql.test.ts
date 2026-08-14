import assert from "node:assert/strict";
import test from "node:test";
import {
  stockLatestCostsCte,
  stockMarkupPercentSql,
} from "./stockInventorySortSql";

test("stock cost sorting selects one latest received purchase per product", () => {
  const sql = stockLatestCostsCte.text;

  assert.match(sql, /DISTINCT ON \(line\."productId"\)/);
  assert.match(sql, /bill\."purchasedAt" DESC/);
  assert.doesNotMatch(sql, /distributorId/);
  assert.doesNotMatch(sql, /AVG\(/);
});

test("stock markup sorting zeroes sell prices from 20 with costs up to 1.07", () => {
  const sql = stockMarkupPercentSql.text;

  assert.match(sql, /THEN 0/);
  assert.match(sql, />= 20/);
  assert.match(sql, /<= 1\.07/);
});
