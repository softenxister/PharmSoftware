import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stockStyles = readFileSync(new URL("../Stock.module.css", import.meta.url), "utf8");
const inventoryFilters = readFileSync(new URL("./StockInventoryFilters.tsx", import.meta.url), "utf8");
const inventoryTable = readFileSync(new URL("./StockInventoryTable.tsx", import.meta.url), "utf8");

test("inventory sidebar uses drag handles without an open or close icon", () => {
  assert.doesNotMatch(inventoryFilters, /sidebarIconButton|sidebarToggleGlyph|setIsOpen/);
  assert.doesNotMatch(stockStyles, /\.sidebarIconButton|\.sidebarToggleGlyph/);
  assert.match(inventoryFilters, /sidebarResizeHandle/);
  assert.match(inventoryFilters, /sidebarEdgeHandle/);
  assert.match(stockStyles, /\.sidebar\.sidebarClosed/);
  assert.match(stockStyles, /\.sidebarEdgeHandle:hover/);
});

test("inventory filters remove the Items placeholder and put Legal Category after Category", () => {
  assert.doesNotMatch(inventoryFilters, /t\("stock\.items"\)/);
  assert.match(
    inventoryFilters,
    /id="stock-category-options"[\s\S]*id="stock-legal-category-options"[\s\S]*id="stock-dosage-type-options"/,
  );
  assert.match(inventoryFilters, /filters\.draft\.legalCategories/);
  assert.match(inventoryFilters, /filters\.toggleOption\("legalCategories", option\)/);
});

test("inventory filters expose all three regulatory records", () => {
  assert.match(inventoryFilters, /STOCK_REGULATORY_FORMS/);
  assert.match(inventoryFilters, /stock-regulatory-record-options/);
  assert.match(inventoryFilters, /filters\.draft\.regulatoryForms/);
  assert.match(inventoryFilters, /filters\.toggleOption\("regulatoryForms", option\)/);
});

test("create item action sits at the far right of the inventory toolbar", () => {
  assert.doesNotMatch(inventoryFilters, /t\("stock\.createItem"\)/);

  const toolbar = inventoryTable.match(
    /<div className=\{styles\.toolbar\}>([\s\S]*?)<\/div>\s*\n\s*<div className=\{styles\.tablePanel\}>/,
  )?.[1];
  assert.ok(toolbar);

  const searchPosition = toolbar.indexOf("className={styles.searchField}");
  const spacerPosition = toolbar.indexOf("className={styles.toolbarSpacer}");
  const createPosition = toolbar.indexOf("styles.toolbarAddButton");

  assert.ok(searchPosition >= 0);
  assert.ok(spacerPosition > searchPosition);
  assert.ok(createPosition > spacerPosition);
  assert.match(toolbar, /styles\.createActionButton/);
  assert.match(toolbar, /onClick=\{controller\.productEntry\.openCreate\}/);
  assert.match(toolbar, /t\("stock\.createItem"\)/);
});

test("sortable inventory headers align their labels with column values instead of sort icons", () => {
  assert.match(
    inventoryTable,
    /styles\.sortButtonEnd : ""/,
  );
  assert.match(inventoryTable, /sortHeader\("minimum", t\("stock\.minimumShort"\), "end"\)/);
  assert.match(inventoryTable, /sortHeader\("maximum", t\("stock\.maximumShort"\), "end"\)/);
  assert.match(inventoryTable, /sortHeader\("stock", t\("nav\.stock"\), "end"\)/);
  assert.match(inventoryTable, /sortHeader\("cost", t\("stock\.cost"\), "end"\)/);
  assert.match(inventoryTable, /sortHeader\("markup", t\("stock\.markupShort"\), "end"\)/);
  assert.match(inventoryTable, /sortHeader\("sellPrice", t\("stock\.sellPrice"\), "end"\)/);
  assert.doesNotMatch(inventoryTable, /<th>\{t\("stock\.locationShort"\)\}<\/th>/);
  assert.match(
    stockStyles,
    /\.sortButtonEnd\s*{[^}]*flex-direction:\s*row-reverse;[^}]*margin:\s*0 -7px 0 0;/s,
  );
});

test("edit backdrop and inventory header follow the app content boundary", () => {
  assert.match(
    stockStyles,
    /\.stockWindowBackdrop\s*{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s,
  );
  assert.doesNotMatch(
    stockStyles,
    /\.stockWindowBackdrop\s*{[^}]*inset:\s*56px 0 0;/s,
  );
  assert.match(
    stockStyles,
    /\.stockEntryWindowEdit\s*{[^}]*height:\s*min\(573px, calc\(100% - 32px\)\);/s,
  );
  assert.match(
    stockStyles,
    /\.sidebarHeader\s*{[^}]*margin-top:\s*0;/s,
  );
  assert.match(
    stockStyles,
    /\.content\s*{[^}]*padding:\s*12px 14px 14px;/s,
  );
});
