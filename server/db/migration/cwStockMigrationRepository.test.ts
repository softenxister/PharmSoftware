import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("CW stock migration persists the uploaded latest cost on the product", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const repository = readFileSync(new URL("./cwStockMigrationRepository.ts", import.meta.url), "utf8");

  assert.match(schema, /migrationCostThb\s+Decimal\?/);
  assert.match(repository, /"migrationCostThb"/);
  assert.match(repository, /source\.lastCostThb/);
});

test("CW stock migration persists the uploaded raw generic name separately from verified ingredients", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const repository = readFileSync(new URL("./cwStockMigrationRepository.ts", import.meta.url), "utf8");

  assert.match(schema, /migrationGenericName\s+String\?/);
  assert.match(repository, /"migrationGenericName"/);
  assert.match(repository, /source\.genericName/);
});

test("average-cost migration removes dummy purchase history first", () => {
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260804233000_add_product_migration_cost/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /DELETE FROM "PurchaseBill";[\s\S]*ADD COLUMN "migrationCostThb"/);
});
