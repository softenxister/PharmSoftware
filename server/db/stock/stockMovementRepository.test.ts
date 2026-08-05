import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@server/generated/prisma/client";
import { receivePurchasedStock } from "./stockMovementRepository";

test("receiving a purchase supplies timestamps required by a new stock batch", async () => {
  let statement: Prisma.Sql | undefined;
  const transaction = {
    product: {
      findFirst: async () => ({
        id: "product-1",
        itemName: "Test medicine",
        batches: [],
      }),
    },
    $executeRaw: async (query: Prisma.Sql) => {
      statement = query;
      return 1;
    },
  } as unknown as Prisma.TransactionClient;

  await receivePurchasedStock(transaction, [{
    productId: "product-1",
    barcode: "8850001000014",
    batchNo: "LOT-1",
    expiryDate: "2027-12-31",
    quantity: 2,
    unitMultiplier: 1,
    freeQuantity: 0,
    freeUnitMultiplier: 1,
    cost: 40,
  }]);

  assert.ok(statement);
  const sql = statement.strings.join("?");
  assert.match(sql, /"createdAt", "updatedAt"/);
  assert.match(sql, /CURRENT_TIMESTAMP,\s+CURRENT_TIMESTAMP/);
});
