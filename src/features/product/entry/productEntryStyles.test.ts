import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./ProductEntryForm.tsx", import.meta.url), "utf8");
const productStyles = readFileSync(new URL("./ProductEntry.module.css", import.meta.url), "utf8");
const stockStyles = readFileSync(new URL("../../stock/Stock.module.css", import.meta.url), "utf8");

test("edit item uses an accessible four-tab workspace", () => {
  assert.match(form, /role="tablist"/);
  assert.match(form, /role="tab"/);
  assert.match(form, /role="tabpanel"/);
  assert.match(form, /activeEditTab === "general"/);
  assert.match(form, /activeEditTab === "pricing-stock"/);
  assert.match(form, /activeEditTab === "ingredients"/);
  assert.match(form, /activeEditTab === "packaging"/);
});

test("edit item stays wide and two-column on desktop and tablet", () => {
  assert.match(
    stockStyles,
    /\.stockEntryWindowEdit\s*{[^}]*width:\s*min\(900px, calc\(100vw - 32px\)\);/s,
  );
  assert.match(
    productStyles,
    /\.editWorkspace\s*{[^}]*grid-template-columns:\s*240px minmax\(0, 1fr\);/s,
  );
  assert.match(
    productStyles,
    /@media \(max-width: 980px\)[\s\S]*\.editWorkspace\s*{[^}]*grid-template-columns:\s*220px minmax\(0, 1fr\);/,
  );
});

test("edit item photo, inset rows, and active tab follow the visual contract", () => {
  assert.match(
    productStyles,
    /\.editPhotoPreview\s*{[^}]*aspect-ratio:\s*1 \/ 1;[^}]*border-radius:\s*12px;/s,
  );
  assert.match(
    productStyles,
    /\.editTabButtonActive\s*{[^}]*border-bottom-color:\s*var\(--stock-ink\);/s,
  );
  assert.match(
    productStyles,
    /\.editInsetRow \+ \.editInsetRow\s*{[^}]*border-top:\s*1px solid var\(--stock-border-soft\);/s,
  );
});
