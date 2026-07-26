import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { LotExpiryMigrationRow } from "@/server/import/lotExpiryMigration";
import {
  buildLotExpiryBatchWrites,
  buildLotExpiryProductUnitWrites,
  LOT_EXPIRY_MIGRATION_TRANSACTION_OPTIONS,
} from "./lotExpiryMigrationRepository";

const matchedRow: LotExpiryMigrationRow = {
  sourceRow: 10,
  sequence: 1,
  externalProductCode: "P-100",
  itemName: "Example",
  reportedAmount: 5,
  unit: "กล่อง",
  remainderAmount: 0,
  batches: [
    {
      lotNo: "ABC",
      expiryDate: "2028-01-01",
      amount: 2,
      unit: "กล่อง",
      generatedLotNo: false,
      sourceRows: [11],
    },
    {
      lotNo: "ABC",
      expiryDate: "2029-01-01",
      amount: 3,
      unit: "กล่อง",
      generatedLotNo: false,
      sourceRows: [11],
    },
  ],
  status: "matched",
  matchedProductId: "product-100",
  matchedItemName: "Existing example",
  sellPriceThb: 45,
  issue: null,
};

test("lot and expiry batch writes preserve equal lot numbers with different expiry dates", () => {
  assert.deepEqual(
    buildLotExpiryBatchWrites(matchedRow, (index) => `batch-${index}`),
    [
      {
        id: "batch-0",
        productId: "product-100",
        batchNo: "ABC",
        expiryDate: "2028-01-01",
        sellPriceThb: 45,
        availableStock: 2,
      },
      {
        id: "batch-1",
        productId: "product-100",
        batchNo: "ABC",
        expiryDate: "2029-01-01",
        sellPriceThb: 45,
        availableStock: 3,
      },
    ],
  );
});

test("lot and expiry batch writes preserve a blank lot and expiry remainder", () => {
  assert.deepEqual(
    buildLotExpiryBatchWrites({
      ...matchedRow,
      remainderAmount: 3,
      batches: [{
        lotNo: "",
        expiryDate: "",
        amount: 3,
        unit: "กล่อง",
        generatedLotNo: false,
        sourceRows: [10],
      }],
    }, (index) => `batch-${index}`),
    [{
      id: "batch-0",
      productId: "product-100",
      batchNo: null,
      expiryDate: "",
      sellPriceThb: 45,
      availableStock: 3,
    }],
  );
});

test("lot and expiry import uses a serializable extended transaction", () => {
  assert.equal(LOT_EXPIRY_MIGRATION_TRANSACTION_OPTIONS.isolationLevel, "Serializable");
  assert.ok((LOT_EXPIRY_MIGRATION_TRANSACTION_OPTIONS.timeout ?? 0) >= 60_000);
});

test("lot and expiry import persists canonical product unit keys", () => {
  assert.deepEqual(
    buildLotExpiryProductUnitWrites([
      { ...matchedRow, matchedProductId: "product-sachet", unit: "ซอง" },
      { ...matchedRow, matchedProductId: "product-piece-a", unit: "อัน" },
      { ...matchedRow, matchedProductId: "product-piece-b", unit: "ชิ้น" },
    ]),
    [
      { packUnit: "sachet", productIds: ["product-sachet"] },
      { packUnit: "piece", productIds: ["product-piece-a", "product-piece-b"] },
    ],
  );
});

test("the batch identity migration is additive and keys batches by product, lot, and expiry", () => {
  const schema = readFileSync(
    new URL("../../../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260726160000_key_product_batches_by_expiry/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(schema, /@@unique\(\[productId, batchNo, expiryDate\]\)/);
  assert.doesNotMatch(migration, /^\s*(?:DELETE|TRUNCATE|DROP\s+TABLE)\b/im);
  assert.match(migration, /DROP INDEX IF EXISTS "ProductBatch_productId_batchNo_key"/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ProductBatch_productId_batchNo_expiryDate_key".*"productId", "batchNo", "expiryDate"/s,
  );
});
