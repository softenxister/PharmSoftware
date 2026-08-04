import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stockStyles = readFileSync(new URL("../Stock.module.css", import.meta.url), "utf8");
const inventoryFilters = readFileSync(new URL("./StockInventoryFilters.tsx", import.meta.url), "utf8");

test("inventory sidebar uses drag handles without an open or close icon", () => {
  assert.doesNotMatch(inventoryFilters, /sidebarIconButton|sidebarToggleGlyph|setIsOpen/);
  assert.doesNotMatch(stockStyles, /\.sidebarIconButton|\.sidebarToggleGlyph/);
  assert.match(inventoryFilters, /sidebarResizeHandle/);
  assert.match(inventoryFilters, /sidebarEdgeHandle/);
  assert.match(stockStyles, /\.sidebar\.sidebarClosed/);
  assert.match(stockStyles, /\.sidebarEdgeHandle:hover/);
});
