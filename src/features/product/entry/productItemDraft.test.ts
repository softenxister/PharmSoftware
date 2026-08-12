import assert from "node:assert/strict";
import test from "node:test";
import {
  addPackagingRow,
  createProductItemDraft,
  getProductBarcodeSlot,
  getMissingProductFields,
  isProductSaveShortcut,
  selectProductIdentityText,
  serializeProductItemDraft,
  setProductBarcodeSlot,
  updatePackagingRow,
} from "./productItemDraft";

test("product barcode slots are limited to three and preserve slot positions", () => {
  assert.equal(getProductBarcodeSlot("111, 222, 333, 444", 0), "111");
  assert.equal(getProductBarcodeSlot("111, 222, 333, 444", 2), "333");
  assert.equal(getProductBarcodeSlot(", 222", 0), "");
  assert.equal(setProductBarcodeSlot(", 222", 0, "111"), "111, 222");
  assert.equal(setProductBarcodeSlot("111", 2, "333"), "111, , 333");
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
  }, "medicine");

  assert.equal(draft.subUnit, "ml");
  assert.equal(draft.unit, "pack");
  assert.equal(draft.dosageForm, "Unclassified");
  assert.equal(draft.packagingRows[0].parentUnit, "bottle");
  assert.equal(draft.packagingRows[0].childUnit, "g");
  assert.deepEqual(getMissingProductFields(draft), []);
});

test("product drafts preserve a manually selected dosage form", () => {
  const draft = createProductItemDraft({ dosageForm: "Capsule" }, "medicine");

  assert.equal(draft.dosageForm, "Capsule");
  assert.equal(
    serializeProductItemDraft(draft, { lotNo: "", expiryDate: "" }).dosageForm,
    "Capsule",
  );
});

test("a product without a physical barcode can still be saved", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine"),
    barcode: "",
    itemName: "Compounded cream",
    sellPrice: "120",
    weightage: "1",
  };

  assert.deepEqual(getMissingProductFields(draft), []);
});

test("packaging transitions preserve the rest of the product draft", () => {
  const initial = createProductItemDraft(undefined, "medicine");
  const withRow = addPackagingRow(initial, "row-2");
  const updated = updatePackagingRow(withRow, "row-2", {
    childQuantity: "24",
    barcode: "8850000000003",
  });

  assert.equal(updated.packagingRows.length, 2);
  assert.equal(updated.packagingRows[1].childQuantity, "24");
  assert.equal(updated.packagingRows[1].barcode, "8850000000003");
  assert.equal(updated.itemCategory, "medicine");
});

test("product serialization preserves the existing stock API contract", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine"),
    barcode: "8850000000001",
    itemName: "Example medicine",
    sellPrice: "120",
    weightage: "500",
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
    brandName: "",
    dosageForm: "Unclassified",
    packagingRows: draft.packagingRows,
  });
});

test("edit serialization binds packaging conversions to the item base unit", () => {
  const draft = {
    ...createProductItemDraft(undefined, "medicine"),
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
