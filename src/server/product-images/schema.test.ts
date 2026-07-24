import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../prisma/migrations/20260724120000_add_product_image_resolution/migration.sql", import.meta.url),
  "utf8",
);

test("product image resolution schema keeps separate identity, candidate, and asset records", () => {
  assert.match(schema, /enum ProductImageResolutionStatus/);
  assert.match(schema, /model ProductIdentifier/);
  assert.match(schema, /model ProductImageCandidate/);
  assert.match(schema, /model ProductImageAsset/);
  assert.match(schema, /imageResolutionStatus\s+ProductImageResolutionStatus\s+@default\(PENDING\)/);
});

test("the additive migration never deletes product or operational data", () => {
  assert.doesNotMatch(migration, /^\s*(?:DELETE|TRUNCATE|DROP\s+TABLE)\b/im);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "imageResolutionStatus"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "ProductImageCandidate"/);
  assert.match(migration, /ON DELETE CASCADE/);
});
