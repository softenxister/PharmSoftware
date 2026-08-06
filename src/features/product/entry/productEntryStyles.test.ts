import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./ProductEntryForm.tsx", import.meta.url), "utf8");
const photoField = readFileSync(new URL("./ProductPhotoField.tsx", import.meta.url), "utf8");
const packagingEditor = readFileSync(new URL("./ProductPackagingEditor.tsx", import.meta.url), "utf8");
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

test("barcode and photo URL use separate boxes with labels above them", () => {
  assert.equal(photoField.match(/styles\.editPhotoFieldGroup/g)?.length, 2);
  assert.doesNotMatch(photoField, /styles\.editInsetList} \$\{styles\.editPhotoFields/);
  assert.match(
    productStyles,
    /\.editPhotoFields\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*12px;/s,
  );
  assert.match(
    productStyles,
    /\.editPhotoFieldGroup\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  );
  assert.match(
    productStyles,
    /\.editPhotoFieldGroup > span:first-child\s*{[^}]*align-self:\s*flex-start;/s,
  );
  assert.match(
    productStyles,
    /\.editPhotoFieldGroup > input,[\s\S]*\.editPhotoFieldGroup > \.inlineField\s*{[^}]*border:\s*1px solid var\(--stock-border\);/,
  );
});

test("edit row labels match their values while photo metadata labels stay compact", () => {
  assert.match(
    productStyles,
    /\.editInsetRow > span:first-child\s*{[^}]*font-size:\s*13px;/s,
  );
  assert.match(
    productStyles,
    /\.editPhotoFieldGroup > span:first-child\s*{[^}]*font-size:\s*11px;/s,
  );
});

test("edit dropdown values align right with their chevrons on the left", () => {
  assert.match(
    productStyles,
    /\.editInsetRow > div > div:first-child\s*{[^}]*flex-direction:\s*row-reverse;/s,
  );
  assert.match(
    productStyles,
    /\.editInsetRow > div > div:first-child > input\s*{[^}]*text-align:\s*right;/s,
  );
});

test("ingredients panel aligns with the top edge of the other tab panels", () => {
  assert.match(
    productStyles,
    /\.stockFormEdit \.editCompositionPanel\s*{[^}]*margin:\s*0;/s,
  );
});

test("edit packaging starts with its cards and derives their child unit", () => {
  assert.match(
    packagingEditor,
    /\{variant === "default" && \(\s*<div className=\{styles\.packagingHeader\}>/s,
  );
  assert.match(
    packagingEditor,
    /\{variant === "default" && \(\s*<label[^>]*>[\s\S]*?stockForm\.subUnit/s,
  );
  assert.match(packagingEditor, /className=\{styles\.packagingRowActions\}/);
  assert.match(
    productStyles,
    /\.stockFormEdit \.editPackagingPanel\s*{[^}]*margin:\s*0;/s,
  );
});

test("edit packaging card actions place delete left and add row right", () => {
  assert.match(
    productStyles,
    /\.stockFormEdit \.editPackagingPanel \.packagingRowActions\s*{[^}]*justify-content:\s*space-between;/s,
  );
  assert.match(
    productStyles,
    /\.stockFormEdit \.editPackagingPanel \.editInsetRow > span:first-child\s*{[^}]*text-align:\s*left;/s,
  );
});
