import assert from "node:assert/strict";
import test from "node:test";
import {
  addPackagingRow,
  createProductItemDraft,
  getMissingProductFields,
  isProductSaveShortcut,
  selectProductIdentityText,
  serializeProductItemDraft,
  updatePackagingRow,
} from "./productItemDraft";

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
  assert.equal(draft.packagingRows[0].parentUnit, "bottle");
  assert.equal(draft.packagingRows[0].childUnit, "g");
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
    packagingRows: draft.packagingRows,
  });
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
