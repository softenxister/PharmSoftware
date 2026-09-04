import assert from "node:assert/strict";
import test from "node:test";
import type { SalesProduct } from "@server/db/types";
import {
  addPackagingRow,
  createProductItemDraft,
  getProductBarcodeSlot,
  getMissingProductFields,
  isProductSaveShortcut,
  productToStockItemInput,
  selectProductIdentityText,
  serializeProductItemDraft,
  setProductBarcodeSlot,
  updatePackagingRow,
} from "./productItemDraft";

const persistedProduct: SalesProduct = {
  id: "product-1",
  itemName: "Server-selected product",
  brandName: "Example",
  manufacturerName: "GPO",
  pack: { packUnit: "box", childUnit: "tablet", childQuantity: 10, label: "10 tablets" },
  parentPacks: [],
  location: "A1",
  barcode: "8850000000001",
  category: "Pain Relief",
  imageUrl: "",
  weeklySold: 0,
  genericName: "Paracetamol",
  legalCategory: "ยาอันตราย",
  dosageForm: "Tablet",
  batches: [{
    batchNo: "LOT-1",
    expiryDate: "2027-08-01",
    sellPriceThb: 45,
    availableStock: 8,
  }],
};

test("persisted Products hydrate the complete Product editor input", () => {
  const input = productToStockItemInput(persistedProduct);

  assert.equal(input.productId, "product-1");
  assert.equal(input.genericName, "Paracetamol");
  assert.equal(input.legalCategory, "ยาอันตราย");
  assert.equal(input.dosageForm, "Tablet");
  assert.equal(input.lotNo, "LOT-1");
});

test("product barcode slots are limited to three and preserve slot positions", () => {
  assert.equal(getProductBarcodeSlot("111, 222, 333, 444", 0), "111");
  assert.equal(getProductBarcodeSlot("111, 222, 333, 444", 2), "333");
  assert.equal(getProductBarcodeSlot(", 222", 0), "");
  assert.equal(setProductBarcodeSlot(", 222", 0, "111"), "111, 222");
  assert.equal(setProductBarcodeSlot("111", 2, "333"), "111, , 333");
});

test("new product drafts use empty values for optional classifications and units", () => {
  const draft = createProductItemDraft(undefined, "medicine", "create");

  assert.equal(draft.itemCategory, "");
  assert.equal(draft.dosageForm, "");
  assert.equal(draft.subUnit, "");
  assert.equal(draft.unit, "");
  assert.equal(draft.packagingRows[0].parentUnit, "");
  assert.equal(draft.packagingRows[0].childUnit, "");
});

test("new products require identity, price, amount, units, and a base-unit barcode", () => {
  const draft = createProductItemDraft(undefined, "medicine", "create");

  assert.deepEqual(getMissingProductFields(draft, "create"), [
    "item name",
    "brand name",
    "sell price",
    "amount",
    "sub unit",
    "unit",
    "base unit barcode",
  ]);

  assert.deepEqual(getMissingProductFields({
    ...draft,
    itemName: "Example medicine",
    brandName: "Example brand",
    sellPrice: "20",
    weightage: "1",
    subUnit: "tablet",
    unit: "tablet",
    barcode: "8850000000001",
  }, "create"), []);
});

test("product drafts normalize imported package units at their boundary", () => {
  const draft = createProductItemDraft({
    barcode: "8850000000001",
    itemName: "Example medicine",
    sellPrice: "120",
    weightage: "500",
    subUnit: "ml",
    unit: "kg",
    packagingRows: [{
      parentUnit: "l",
      childQuantity: "12",
      childUnit: "g",
      barcode: "8850000000002",
      sellPrice: "10",
    }],
  }, "medicine", "edit");

  assert.equal(draft.subUnit, "ml");
  assert.equal(draft.unit, "pack");
  assert.equal(draft.dosageForm, "");
  assert.equal(draft.packagingRows[0].parentUnit, "bottle");
  assert.equal(draft.packagingRows[0].childUnit, "g");
  assert.deepEqual(getMissingProductFields(draft, "edit"), []);
});

test("product drafts preserve a manually selected dosage form", () => {
  const draft = createProductItemDraft({ dosageForm: "Capsule" }, "medicine", "edit");

  assert.equal(draft.dosageForm, "Capsule");
  assert.equal(
    serializeProductItemDraft(draft, { lotNo: "", expiryDate: "" }).dosageForm,
    "Capsule",
  );
});

test("an existing product without a physical barcode can still be edited", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine", "edit"),
    barcode: "",
    itemName: "Compounded cream",
    sellPrice: "120",
    weightage: "1",
  };

  assert.deepEqual(getMissingProductFields(draft, "edit"), []);
});

test("packaging transitions preserve the rest of the product draft", () => {
  const initial = createProductItemDraft(undefined, "medicine", "edit");
  const withRow = addPackagingRow(initial, "row-2");
  const updated = updatePackagingRow(withRow, "row-2", {
    childQuantity: "24",
    barcode: "8850000000003",
  });

  assert.equal(updated.packagingRows.length, 2);
  assert.equal(updated.packagingRows[1].childQuantity, "24");
  assert.equal(updated.packagingRows[1].barcode, "8850000000003");
  assert.equal(updated.itemCategory, "");
});

test("product serialization preserves the existing stock API contract", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine", "create"),
    barcode: "8850000000001",
    itemName: "Example medicine",
    sellPrice: "120",
    weightage: "500",
    itemCategory: "medicine",
    subUnit: "tablet",
    unit: "tablet",
    brandName: "Example brand",
  };

  assert.deepEqual(serializeProductItemDraft(draft, {
    productId: "product-1",
    lotNo: "LOT-1",
    expiryDate: "2027-08-01",
  }), {
    productId: "product-1",
    photoUrl: "",
    barcode: "8850000000001",
    itemName: "Example medicine",
    lotNo: "LOT-1",
    expiryDate: "2027-08-01",
    location: "",
    manufacturer: "",
    sellPrice: "120",
    itemCategory: "medicine",
    weightage: "500",
    subUnit: "tablet",
    unit: "tablet",
    brandName: "Example brand",
    dosageForm: null,
    packagingRows: draft.packagingRows,
  });
});

test("edit serialization binds packaging conversions to the item base unit", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine", "edit"),
    unit: "blisterpack",
    packagingRows: [{
      id: "package-1",
      parentUnit: "box",
      childQuantity: "30",
      childUnit: "tablet",
      barcode: "",
      sellPrice: "",
    }],
  };

  const serialized = serializeProductItemDraft(
    draft,
    { lotNo: "", expiryDate: "" },
    { packagingChildUnit: draft.unit },
  );

  assert.equal(serialized.packagingRows[0].childUnit, "blisterpack");
});

test("product identity selection and edit shortcuts remain mode-specific", () => {
  let selectCount = 0;
  selectProductIdentityText("create", { select: () => { selectCount += 1; } });
  selectProductIdentityText("edit", { select: () => { selectCount += 1; } });
  assert.equal(selectCount, 1);

  assert.equal(isProductSaveShortcut("edit", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }), true);
  assert.equal(isProductSaveShortcut("create", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }), false);
  assert.equal(isProductSaveShortcut("edit", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: true,
    repeat: false,
  }), false);
});

test("product save shortcut follows the physical S key across keyboard layouts", () => {
  const thaiLayoutCtrlS = {
    key: "ห",
    code: "KeyS",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  };

  assert.equal(isProductSaveShortcut("edit", thaiLayoutCtrlS), true);
});
