import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCwStockDetailUpdateWrite,
  CW_STOCK_DETAIL_UPDATE_TRANSACTION_OPTIONS,
} from "./cwStockDetailUpdateRepository";

test("focused product detail write allowlists generic name, Thai legal category, and base-unit migration cost", () => {
  const write = buildCwStockDetailUpdateWrite({
    matchedProductId: "product-1",
    nextGenericName: "Paracetamol",
    nextLegalCategory: "ยาอันตราย",
    nextCostThb: 1.25,
  });

  assert.deepEqual(write, {
    id: "product-1",
    migrationGenericName: "Paracetamol",
    legalCategory: "ยาอันตราย",
    migrationCostThb: 1.25,
  });
  assert.deepEqual(Object.keys(write).sort(), ["id", "legalCategory", "migrationCostThb", "migrationGenericName"]);
});

test("focused product detail update uses a serializable extended transaction", () => {
  assert.equal(CW_STOCK_DETAIL_UPDATE_TRANSACTION_OPTIONS.isolationLevel, "Serializable");
  assert.ok((CW_STOCK_DETAIL_UPDATE_TRANSACTION_OPTIONS.timeout ?? 0) >= 60_000);
});

test("focused product detail repository does not write stock, identity, packaging, or verified ingredients", () => {
  const repository = readFileSync(new URL("./cwStockDetailUpdateRepository.ts", import.meta.url), "utf8");

  assert.match(repository, /UPDATE "Product"/);
  assert.match(repository, /"migrationGenericName" = source\."migrationGenericName"/);
  assert.match(repository, /"legalCategory" = source\."legalCategory"/);
  assert.match(repository, /"migrationCostThb" = source\."migrationCostThb"/);
  assert.match(repository, /migrationCostThb\}::decimal\(16, 4\)/);
  for (const protectedWrite of [
    /UPDATE "ProductBatch"/,
    /UPDATE "ProductParentPack"/,
    /UPDATE "ProductBarcodeAlias"/,
    /UPDATE "ProductIngredient"/,
    /INSERT INTO "StockAdjustment"/,
  ]) {
    assert.doesNotMatch(repository, protectedWrite);
  }
  assert.match(repository, /replaceImportedProductIngredients/);
});

test("focused product detail cost keeps four decimal places in Prisma and PostgreSQL", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260805003000_expand_product_migration_cost_scale/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /migrationCostThb\s+Decimal\?\s+@db\.Decimal\(16, 4\)/);
  assert.match(
    migration,
    /ALTER COLUMN "migrationCostThb" TYPE DECIMAL\(16,4\)/,
  );
});

test("focused product detail updates have a dedicated non-stock audit model", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260804234500_add_cw_product_detail_updates/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /model ProductDataImportRun/);
  assert.match(migration, /CREATE TABLE "ProductDataImportRun"/);
  assert.doesNotMatch(migration, /(?:DELETE|TRUNCATE|DROP\s+TABLE)/i);
});

test("focused product detail legal category migration is additive and separate from merchandising category", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260810120000_add_product_legal_category/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /legalCategory\s+String\?/);
  assert.match(migration, /ALTER TABLE "Product"[\s\S]*ADD COLUMN "legalCategory" TEXT/);
  assert.doesNotMatch(migration, /(?:DELETE|TRUNCATE|DROP)/i);
});
