import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260726194500_remove_automated_product_image_review/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("product image schema keeps stored assets without automated discovery or review state", () => {
  const assetModel = schema.match(/model ProductImageAsset \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(schema, /model ProductImageAsset/);
  assert.match(assetModel, /sourceImageUrl\s+String/);
  assert.doesNotMatch(schema, /enum ProductImageResolutionStatus/);
  assert.doesNotMatch(schema, /enum ProductImageCandidateStatus/);
  assert.doesNotMatch(schema, /model ProductImageCandidate/);
  assert.doesNotMatch(schema, /model ProductIdentifier/);
  assert.doesNotMatch(schema, /imageResolutionStatus|imageCheckedAt|imageRetryAt|imageResolutionError/);
  assert.doesNotMatch(assetModel, /candidateId|sourceLicence|matchedIdentifier|evidence|reviewedBy/);
});

test("the removal migration preserves stored assets while dropping automated records", () => {
  assert.match(migration, /ALTER TABLE "ProductImageAsset"[\s\S]*DROP COLUMN IF EXISTS "candidateId"/);
  assert.match(migration, /DROP TABLE IF EXISTS "ProductImageCandidate"/);
  assert.match(migration, /DROP TABLE IF EXISTS "ProductIdentifier"/);
  assert.match(migration, /DROP COLUMN IF EXISTS "imageResolutionStatus"/);
  assert.doesNotMatch(migration, /DROP TABLE IF EXISTS "ProductImageAsset"/);
});
