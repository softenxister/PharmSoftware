import assert from "node:assert/strict";
import test from "node:test";
import {
  backfillHasRemainingCapacity,
  parseProductImageBackfillOptions,
} from "./backfill";

test("product image backfill defaults to a read-only status check", () => {
  assert.deepEqual(parseProductImageBackfillOptions([]), {
    apply: false,
    batchSize: 25,
    maxItems: Number.MAX_SAFE_INTEGER,
    backupDirectory: "outputs/product-image-backups",
  });
});

test("product image backfill accepts bounded apply options", () => {
  assert.deepEqual(parseProductImageBackfillOptions([
    "--apply",
    "--batch-size",
    "50",
    "--max-items",
    "125",
    "--backup-dir",
    "safe-backups",
  ]), {
    apply: true,
    batchSize: 50,
    maxItems: 125,
    backupDirectory: "safe-backups",
  });
});

test("product image backfill rejects unsafe or ambiguous arguments", () => {
  assert.throws(() => parseProductImageBackfillOptions(["--batch-size", "0"]), /whole number/);
  assert.throws(() => parseProductImageBackfillOptions(["--batch-size", "51"]), /whole number/);
  assert.throws(() => parseProductImageBackfillOptions(["--other"]), /Unknown/);
  assert.equal(backfillHasRemainingCapacity(99, { maxItems: 100 }), true);
  assert.equal(backfillHasRemainingCapacity(100, { maxItems: 100 }), false);
});
