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
