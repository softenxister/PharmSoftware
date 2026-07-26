import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the expiry migration canonicalizes stored dates without inventing missing dates", () => {
  const migration = readFileSync(
    new URL(
      "../../prisma/migrations/20260726190000_canonical_expiry_dates/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const table of ["ProductBatch", "PurchaseLine", "SaleLine"]) {
    assert.match(migration, new RegExp(`UPDATE "${table}"`));
  }
  assert.match(migration, /TO_CHAR\(TO_DATE\("expiryDate", 'DD\/MM\/YYYY'\), 'YYYY-MM-DD'\)/);
  assert.match(migration, /ProductBatch_expiryDate_iso_check/);
  assert.match(migration, /PurchaseLine_expiryDate_iso_check/);
  assert.match(migration, /SaleLine_expiryDate_iso_check/);
  assert.doesNotMatch(migration, /SET "expiryDate" = NULL/);
});
