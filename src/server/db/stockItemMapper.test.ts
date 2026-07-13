import assert from "node:assert/strict";
import test from "node:test";
import { relatedLineUpdates } from "./stockItemMapper";

test("stock item edits update descriptive purchase and sale line data", () => {
  const updates = relatedLineUpdates({
    id: "p-1",
    itemName: "Updated item",
    barcode: "8850000000001",
    location: "B-12",
  });

  assert.deepEqual(updates, {
    purchaseLines: {
      where: { productId: "p-1" },
      data: { itemName: "Updated item", barcode: "8850000000001" },
    },
    saleLines: {
      where: { productId: "p-1" },
      data: { itemName: "Updated item", location: "B-12" },
    },
  });
});
