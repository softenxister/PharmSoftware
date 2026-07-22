import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { StockItemInput } from "./types";
import {
  createSavedStockItem,
  normalizeBarcodeValues,
  relatedLineUpdates,
  savedStockToSalesProduct,
} from "./stockItemMapper";

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

test("comma-separated barcode values are deduplicated in input order", () => {
  assert.deepEqual(
    normalizeBarcodeValues("111, 222", ["222", "333; 444"]),
    ["111", "222", "333", "444"],
  );
});

test("same-name package variants keep separate quantities, prices, and barcodes", () => {
  const input: StockItemInput = {
    photoUrl: "",
    barcode: "100, 101",
    itemName: "Test sachet",
    lotNo: "LOT-1",
    expiryDate: "2028-01-01",
    location: "A1",
    manufacturer: "Maker",
    sellPrice: "5",
    itemCategory: "Test",
    weightage: "1",
    subUnit: "sachet",
    unit: "sachet",
    brandName: "Test",
    packagingRows: [
      { parentUnit: "box", childQuantity: "20", childUnit: "sachet", barcode: "200, 201", sellPrice: "95" },
      { parentUnit: "box", childQuantity: "40", childUnit: "sachet", barcode: "400, 401", sellPrice: "180" },
    ],
  };

  const saved = createSavedStockItem(input);
  const product = savedStockToSalesProduct(saved);

  assert.equal(product.barcode, "100");
  assert.deepEqual(product.barcodes, ["101"]);
  assert.deepEqual(product.parentPacks.map((pack) => ({
    unit: pack.packUnit,
    quantity: pack.childPackQuantity,
    sellPrice: pack.sellPriceThb,
    barcodes: pack.barcodes,
  })), [
    { unit: "box", quantity: 20, sellPrice: 95, barcodes: ["200", "201"] },
    { unit: "box", quantity: 40, sellPrice: 180, barcodes: ["400", "401"] },
  ]);
});

test("parent-pack database identity includes unit and quantity", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const parentPackModel = schema.match(/model ProductParentPack \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    parentPackModel,
    /@@unique\(\[productId, packUnit, childPackQuantity\]\)/,
  );
});
