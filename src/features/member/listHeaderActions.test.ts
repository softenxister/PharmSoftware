import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const salesHomeSource = readFileSync(new URL("../sales/SalesHome.tsx", import.meta.url), "utf8");
const purchaseHomeSource = readFileSync(new URL("../purchase/PurchaseHome.tsx", import.meta.url), "utf8");
const memberDirectorySource = readFileSync(new URL("./MemberDirectory.tsx", import.meta.url), "utf8");

test("list page headers retain their creation actions", () => {
  assert.match(salesHomeSource, /className=\{styles\.newSaleButton\}[\s\S]*?onClick=\{goToNewSale\}/);
  assert.match(purchaseHomeSource, /className=\{styles\.newPurchaseButton\}[\s\S]*?onClick=\{\(\) => navigate\("\/purchase\/new"\)\}/);
  assert.match(memberDirectorySource, /className=\{styles\.createButton\}[\s\S]*?onClick=\{creator\.beginCreate\}/);
});
