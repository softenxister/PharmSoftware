import assert from "node:assert/strict";
import test from "node:test";
import { stockLatestCostsCte } from "./stockInventorySortSql";

test("stock cost sorting selects one latest received purchase per product", () => {
  const sql = stockLatestCostsCte.text;

  assert.match(sql, /DISTINCT ON \(line\."productId"\)/);
  assert.match(sql, /bill\."purchasedAt" DESC/);
  assert.doesNotMatch(sql, /distributorId/);
  assert.doesNotMatch(sql, /AVG\(/);
});
