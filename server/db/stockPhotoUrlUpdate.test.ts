import assert from "node:assert/strict";
import test from "node:test";
import type { StockItemInput } from "./types";
import { isStockPhotoUrlOnlyChange } from "@/lib/stockPhotoUrlChange";
import { parseStockPhotoUrlUpdate } from "./stockPhotoUrlUpdate";

const original: StockItemInput = {
  productId: "product-1",
  photoUrl: "/api/product-images/product-1?v=old",
  barcode: "8850000000001",
  itemName: "Example medicine",
  lotNo: "LOT-1",
  expiryDate: "2028-01-01",
  location: "A1",
  manufacturer: "Example",
  sellPrice: "20",
  itemCategory: "Medicine",
  weightage: "10",
  subUnit: "tablet",
  unit: "box",
  brandName: "Example",
  packagingRows: [{
    parentUnit: "box",
    childQuantity: "10",
    childUnit: "tablet",
    barcode: "8850000000002",
    sellPrice: "180",
  }],
};

test("recognizes a photo-only edit so it can bypass the full stock transaction", () => {
  assert.equal(isStockPhotoUrlOnlyChange(original, {
    ...original,
    photoUrl: "https://images.example.com/new.jpg",
    packagingRows: [{
      ...original.packagingRows[0],
      id: "package-1",
    } as StockItemInput["packagingRows"][number]],
  }), true);
  assert.equal(isStockPhotoUrlOnlyChange(original, {
    ...original,
    photoUrl: "https://images.example.com/new.jpg",
    sellPrice: "25",
  }), false);
  assert.equal(isStockPhotoUrlOnlyChange(original, original), false);
});

test("accepts a bounded public HTTPS photo URL without downloading it", () => {
  assert.deepEqual(parseStockPhotoUrlUpdate({
    productId: " product-1 ",
    photoUrl: " https://images.example.com:8443/new.jpg ",
  }), {
    productId: "product-1",
    photoUrl: "https://images.example.com:8443/new.jpg",
  });
});

test("rejects invalid, managed, placeholder, and insecure photo URL updates", () => {
  assert.equal(parseStockPhotoUrlUpdate({
    productId: "",
    photoUrl: "https://images.example.com/new.jpg",
  }), null);
  assert.equal(parseStockPhotoUrlUpdate({
    productId: "product-1",
    photoUrl: "/api/product-images/product-1",
  }), null);
  assert.equal(parseStockPhotoUrlUpdate({
    productId: "product-1",
    photoUrl: "https://placehold.co/400x400",
  }), null);
  assert.equal(parseStockPhotoUrlUpdate({
    productId: "product-1",
    photoUrl: "http://images.example.com/new.jpg",
  }), null);
});
