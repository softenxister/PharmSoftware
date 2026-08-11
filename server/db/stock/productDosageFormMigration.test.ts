import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../prisma/migrations/20260811170000_add_product_dosage_form/migration.sql", import.meta.url),
  "utf8",
);

test("Product stores a canonical dosage form and its precedence source", () => {
  assert.match(schema, /enum ProductDosageFormSource \{[\s\S]*INFERRED[\s\S]*THAI_FDA[\s\S]*MANUAL[\s\S]*\}/);
  assert.match(schema, /dosageForm\s+String\s+@default\("Unclassified"\)/);
  assert.match(schema, /dosageFormSource\s+ProductDosageFormSource\s+@default\(INFERRED\)/);
});

test("dosage-form migration adds guarded values and conservatively backfills products", () => {
  assert.match(migration, /ADD COLUMN "dosageForm" TEXT NOT NULL DEFAULT 'Unclassified'/);
  assert.match(migration, /ADD COLUMN "dosageFormSource" "ProductDosageFormSource" NOT NULL DEFAULT 'INFERRED'/);
  assert.match(migration, /Product_dosage_form_check/);
  assert.match(migration, /Personal Care & Cosmetics/i);
  assert.match(migration, /Medical Devices & Diagnostics/i);
  assert.match(migration, /Not Applicable/);
  assert.match(migration, /Unclassified/);
  assert.match(migration, /WHEN "childUnit" IN \('tablet', 'capsule'\)/);
  assert.doesNotMatch(migration, /(?:DELETE FROM|TRUNCATE)/i);
});
