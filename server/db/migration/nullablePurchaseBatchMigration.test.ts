import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("purchase and stock batches store a missing batch number as null", () => {
  const schema = readFileSync(
    new URL("../../../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260726183000_nullable_purchase_batches/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(schema, /model ProductBatch \{[\s\S]*?batchNo\s+String\?/);
  assert.match(schema, /model PurchaseLine \{[\s\S]*?batchNo\s+String\?/);
  assert.match(migration, /ALTER TABLE "ProductBatch" ALTER COLUMN "batchNo" DROP NOT NULL/);
  assert.match(migration, /ALTER TABLE "PurchaseLine" ALTER COLUMN "batchNo" DROP NOT NULL/);
  assert.match(migration, /SET "batchNo" = NULL/);
  assert.match(migration, /NULLS NOT DISTINCT/);
  assert.doesNotMatch(migration, /SET "expiryDate" = NULL/);
});
