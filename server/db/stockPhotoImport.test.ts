import assert from "node:assert/strict";
import test from "node:test";
import { parseStockPhotoImportInput } from "./stockPhotoImport";

test("explicit stock photo imports require a product id and HTTPS photo URL", () => {
  assert.deepEqual(parseStockPhotoImportInput({
    productId: " product-1 ",
    photoUrl: " https://cdn.example.com/item.png ",
  }), {
    productId: "product-1",
    photoUrl: "https://cdn.example.com/item.png",
  });

  assert.equal(parseStockPhotoImportInput({ productId: "", photoUrl: "https://cdn.example.com/item.png" }), null);
  assert.equal(parseStockPhotoImportInput({ productId: "product-1", photoUrl: "http://cdn.example.com/item.png" }), null);
  assert.equal(parseStockPhotoImportInput({ productId: "product-1", photoUrl: "/api/product-images/product-1" }), null);
  assert.equal(parseStockPhotoImportInput({ productId: "product-1", photoUrl: "not-a-url" }), null);
});
