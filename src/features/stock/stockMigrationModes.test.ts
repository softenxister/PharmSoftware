import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../pages/stock/StockMigrationPage.tsx", import.meta.url), "utf8");
const fullPreview = readFileSync(new URL("./migration/MigrationPreviewPanel.tsx", import.meta.url), "utf8");
const focusedPreview = readFileSync(new URL("./migration/StockDetailUpdatePreviewPanel.tsx", import.meta.url), "utf8");

test("stock migration uses one uploader with explicit full and focused update modes", () => {
  assert.match(page, /Full stock import/);
  assert.match(page, /Update generic, legal category &amp; latest cost/);
  assert.match(page, /aria-pressed=\{mode === "full"\}/);
  assert.match(page, /aria-pressed=\{mode === "generic-cost-update"\}/);
  assert.equal((page.match(/type="file"/g) ?? []).length, 1);
});

test("full preview shows raw generic name and base-unit latest cost", () => {
  assert.match(fullPreview, /row\.genericName/);
  assert.match(fullPreview, /row\.lastCostThb/);
  assert.match(fullPreview, /Base-unit cost/);
});

test("focused confirmation explains the protected product fields", () => {
  assert.match(focusedPreview, /Legal category/);
  assert.match(focusedPreview, /fills an empty generic name/);
  assert.match(focusedPreview, /Names, barcodes, packaging, selling prices, verified ingredients, and stock remain unchanged/);
  assert.match(focusedPreview, /preview\.summary\.changedCount === 0/);
});
