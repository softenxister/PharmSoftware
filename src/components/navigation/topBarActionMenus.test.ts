import assert from "node:assert/strict";
import test from "node:test";
import { topBarActionMenus } from "./topBarActionMenus";

test("sales, purchase, stock, and member navigation expose their expected hover actions", () => {
  assert.deepEqual(topBarActionMenus["nav.sales"], [
    { labelKey: "nav.newSale", href: "/sales/new", icon: "plus" },
  ]);
  assert.deepEqual(topBarActionMenus["nav.purchase"], [
    { labelKey: "purchase.new", href: "/purchase/new", icon: "plus" },
  ]);
  assert.deepEqual(topBarActionMenus["nav.member"], [
    { labelKey: "member.create", href: "/member?create=1", icon: "plus" },
  ]);
  assert.deepEqual(
    topBarActionMenus["nav.stock"].map(({ href }) => href),
    ["/stock/migration", "/stock/discounts", "/stock/adjustment", "/stock/min-max"],
  );
});
