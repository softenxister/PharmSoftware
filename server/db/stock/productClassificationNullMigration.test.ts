import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../prisma/migrations/20260814190000_store_unclassified_as_null/migration.sql", import.meta.url),
  "utf8",
);

test("unclassified product classifications are nullable database values", () => {
  assert.match(schema, /categoryId\s+String\?/);
  assert.match(schema, /dosageForm\s+String\?/);
  assert.doesNotMatch(schema, /dosageForm\s+String\??\s+@default\("Unclassified"\)/);
  assert.match(schema, /category\s+Category\?\s+@relation/);

  assert.match(migration, /ALTER COLUMN "categoryId" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "dosageForm" DROP DEFAULT/);
  assert.match(migration, /ALTER COLUMN "dosageForm" DROP NOT NULL/);
  assert.match(migration, /SET "categoryId" = NULL/i);
  assert.match(migration, /SET "dosageForm" = NULL/i);
  assert.match(migration, /DELETE FROM "Category"/i);
});
