import assert from "node:assert/strict";
import test from "node:test";
import { combineMemberPurchaseHistory } from "./memberPurchaseHistory";

test("member item history combines paid sales and imported aggregate records by product and unit", () => {
  const items = combineMemberPurchaseHistory([
    {
      recordId: "sale-1",
      productId: "product-1",
      itemName: "Betadine",
      unit: "ขวด",
      quantity: 2,
      totalAmount: 160,
      purchasedAt: "2026-07-22T09:00:00.000Z",
    },
    {
      recordId: "report-a",
      productId: "product-1",
      itemName: "Betadine",
      unit: "ขวด",
      quantity: 3,
      totalAmount: 240,
      purchasedAt: "2026-07-21T12:00:00.000Z",
      purchaseCountKnown: false,
    },
    {
      recordId: "report-b",
      productId: "product-1",
      itemName: "Betadine",
      unit: "กล่อง",
      quantity: 1,
      totalAmount: 500,
      purchasedAt: "2026-07-20T12:00:00.000Z",
      purchaseCountKnown: false,
    },
  ]);

  assert.deepEqual(items, [
    {
      historyKey: "product-1\u0000ขวด",
      productId: "product-1",
      itemName: "Betadine",
      totalQuantity: 5,
      totalAmount: 400,
      unit: "ขวด",
      purchaseCount: null,
      lastPurchasedAt: "2026-07-22T09:00:00.000Z",
    },
    {
      historyKey: "product-1\u0000กล่อง",
      productId: "product-1",
      itemName: "Betadine",
      totalQuantity: 1,
      totalAmount: 500,
      unit: "กล่อง",
      purchaseCount: null,
      lastPurchasedAt: "2026-07-20T12:00:00.000Z",
    },
  ]);
});

test("duplicate record identifiers count once without discarding their line quantities", () => {
  const items = combineMemberPurchaseHistory([
    {
      recordId: "sale-1",
      productId: "product-1",
      itemName: "Product",
      unit: "ชิ้น",
      quantity: 1,
      totalAmount: 10,
      purchasedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      recordId: "sale-1",
      productId: "product-1",
      itemName: "Product",
      unit: "ชิ้น",
      quantity: 2,
      totalAmount: 20,
      purchasedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  assert.equal(items[0].totalQuantity, 3);
  assert.equal(items[0].totalAmount, 30);
  assert.equal(items[0].purchaseCount, 1);
});
