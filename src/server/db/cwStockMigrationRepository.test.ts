import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkCwStockImportRows,
  CW_STOCK_IMPORT_BATCH_SIZE,
  CW_STOCK_MIGRATION_TRANSACTION_OPTIONS,
} from "./cwStockMigrationRepository";

test("CW stock migration allows enough transaction time for a large remote import", () => {
  assert.ok(
    (CW_STOCK_MIGRATION_TRANSACTION_OPTIONS.timeout ?? 0) >= 60_000,
    "the migration transaction must not use Prisma's 5-second default timeout",
  );
});

test("CW stock migration bounds a 12,000-product import into bulk database batches", () => {
  const rows = Array.from({ length: 12_000 }, (_, index) => index);
  const batches = chunkCwStockImportRows(rows);

  assert.equal(batches.length, Math.ceil(rows.length / CW_STOCK_IMPORT_BATCH_SIZE));
  assert.ok(batches.length < 100, "12,000 products should require fewer than 100 bulk statements per operation");
  assert.deepEqual(batches.flat(), rows);
  assert.ok(batches.every((batch) => batch.length <= CW_STOCK_IMPORT_BATCH_SIZE));
});
