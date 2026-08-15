import assert from "node:assert/strict";
import test from "node:test";
import {
  parseProductWriteRequest,
  resolveProductWriteDosage,
  resolveProductWriteIdentity,
} from "./productWrite";

const validProduct = () => ({
  photoUrl: "",
  barcode: " 8850000000001, 8850000000002 ",
  itemName: " Test tablets ",
  lotNo: " LOT-1 ",
  expiryDate: "01/08/2028",
  location: " A-01 ",
  manufacturer: " Test maker ",
  sellPrice: " 12.50 ",
  itemCategory: " Pain relief ",
  weightage: " 10 ",
  subUnit: "caplet",
  unit: "VIAL",
  brandName: " Test brand ",
  dosageForm: "Capsule",
  packagingRows: [
    {
      parentUnit: "container",
      childQuantity: "20",
      childUnit: "PEN.",
      barcode: "8850000000020, 8850000000021",
      sellPrice: "230",
    },
  ],
});

test("Product write normalizes one valid request before persistence", () => {
  const parsed = parseProductWriteRequest(validProduct());

  assert.deepEqual(parsed, {
    mode: "single",
    items: [{
      productId: undefined,
      photoUrl: "",
      barcodes: ["8850000000001", "8850000000002"],
      itemName: "Test tablets",
      lotNo: "LOT-1",
      expiryDate: "2028-08-01",
      location: "A-01",
      manufacturer: "Test maker",
      sellPriceThb: 12.5,
      category: "Pain relief",
      childQuantity: 10,
      childUnit: "tablet",
      packUnit: "bottle",
      brandName: "Test brand",
      dosageForm: "Capsule",
      packaging: [{
        packUnit: "jar",
        childQuantity: 20,
        childUnit: "piece",
        barcodes: ["8850000000020", "8850000000021"],
        sellPriceThb: 230,
      }],
    }],
  });
});

test("Product write requires brand and base-unit barcode when creating", () => {
  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    barcode: "",
    packagingRows: [],
  }), null);

  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    brandName: "",
  }), null);
});

test("Product write converts unclassified category and dosage form to null", () => {
  for (const itemCategory of ["", "Unclassified"]) {
    const parsed = parseProductWriteRequest({
      ...validProduct(),
      itemCategory,
      dosageForm: "Unclassified",
    });

    assert.ok(parsed);
    assert.equal(parsed.items[0].category, null);
    assert.equal(parsed.items[0].dosageForm, null);
  }
});

test("Product write keeps legacy blank brand and barcode compatible when editing", () => {
  const parsed = parseProductWriteRequest({
    ...validProduct(),
    productId: "product-1",
    barcode: "",
    brandName: "",
    packagingRows: [],
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.items[0].barcodes, []);
});

test("Product write ignores only an unused default packaging row", () => {
  const parsed = parseProductWriteRequest({
    ...validProduct(),
    packagingRows: [{
      parentUnit: "box",
      childQuantity: "",
      childUnit: "blisterpack",
      barcode: "",
      sellPrice: "",
    }],
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.items[0].packaging, []);
});

test("Product write rejects partial or invalid packaging rows", () => {
  const invalidRows = [
    { parentUnit: "box", childQuantity: "", childUnit: "tablet", barcode: "123", sellPrice: "" },
    { parentUnit: "box", childQuantity: "0", childUnit: "tablet", barcode: "", sellPrice: "" },
    { parentUnit: "box", childQuantity: "10", childUnit: "unknown-unit", barcode: "", sellPrice: "" },
    { parentUnit: "box", childQuantity: "10", childUnit: "tablet", barcode: "", sellPrice: "free" },
  ];

  for (const packagingRow of invalidRows) {
    assert.equal(parseProductWriteRequest({
      ...validProduct(),
      packagingRows: [packagingRow],
    }), null);
  }
});

test("Product write rejects duplicate barcodes across every packaging level", () => {
  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    barcode: "8850000000001, 8850000000001",
    packagingRows: [],
  }), null);

  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    barcode: "8850000000001",
    packagingRows: [{
      parentUnit: "box",
      childQuantity: "10",
      childUnit: "tablet",
      barcode: "8850000000001",
      sellPrice: "100",
    }],
  }), null);
});

test("Product write accepts blank or public HTTPS photos and rejects unsafe values", () => {
  const secure = parseProductWriteRequest({
    ...validProduct(),
    photoUrl: "https://images.example.com/product.png",
  });
  assert.ok(secure);
  assert.equal(secure.items[0].photoUrl, "https://images.example.com/product.png");

  for (const photoUrl of [
    "http://images.example.com/product.png",
    "https://placeholder.com/product.png",
    "not a URL",
  ]) {
    assert.equal(parseProductWriteRequest({ ...validProduct(), photoUrl }), null);
  }
});

test("Product write preserves a zero-priced parent pack when updating CRAVIXIN", () => {
  const parsed = parseProductWriteRequest({
    productId: "cw-p-4401-5dea5460",
    photoUrl: "https://ratutid9pharmacy.com/wp-content/uploads/2025/09/%E0%B8%84%E0%B8%A3%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%8B%E0%B8%B4%E0%B8%99-500mg-Cravixin-10%E0%B9%80%E0%B8%A1%E0%B9%87%E0%B8%94-%E0%B8%81%E0%B8%A5.10%E0%B9%81%E0%B8%9C%E0%B8%87-1.webp",
    barcode: "8859999019270",
    itemName: "CRAVIXIN 500MG.5'S.",
    lotNo: "50987",
    expiryDate: "2028-07-04",
    location: "-",
    manufacturer: "POLIPHARM CO.,LTD.",
    sellPrice: "100",
    itemCategory: "",
    weightage: "5",
    subUnit: "tablet",
    unit: "blisterpack",
    brandName: "CRAVIXIN",
    dosageForm: "Tablet",
    packagingRows: [{
      parentUnit: "กล่อง",
      childQuantity: "10",
      childUnit: "แผง",
      barcode: "8852645211011",
      sellPrice: "0",
    }],
  });

  assert.ok(parsed);
  assert.equal(parsed.items[0].photoUrl, "https://ratutid9pharmacy.com/wp-content/uploads/2025/09/%E0%B8%84%E0%B8%A3%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%8B%E0%B8%B4%E0%B8%99-500mg-Cravixin-10%E0%B9%80%E0%B8%A1%E0%B9%87%E0%B8%94-%E0%B8%81%E0%B8%A5.10%E0%B9%81%E0%B8%9C%E0%B8%87-1.webp");
  assert.equal(parsed.items[0].packaging[0].sellPriceThb, 0);
});

test("Product write accepts only the edited product's managed photo URL", () => {
  const managed = parseProductWriteRequest({
    ...validProduct(),
    productId: "p-managed",
    photoUrl: "/api/product-images/p-managed?v=abc123",
  });
  assert.ok(managed);
  assert.equal(managed.items[0].photoUrl, "/api/product-images/p-managed?v=abc123");

  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    productId: "p-managed",
    photoUrl: "/api/product-images/p-another",
  }), null);
  assert.equal(parseProductWriteRequest({
    ...validProduct(),
    photoUrl: "/api/product-images/p-managed",
  }), null);
});

test("Product write rejects invalid base Product invariants", () => {
  const invalidPatches = [
    { itemName: "" },
    { sellPrice: "0" },
    { sellPrice: "NaN" },
    { sellPrice: "12.345" },
    { sellPrice: "1000000000000" },
    { weightage: "0" },
    { weightage: "Infinity" },
    { weightage: "1.0001" },
    { weightage: "100000000000" },
    { unit: "unknown-unit" },
    { subUnit: "unknown-unit" },
    { dosageForm: "ml" },
  ];

  for (const patch of invalidPatches) {
    assert.equal(parseProductWriteRequest({ ...validProduct(), ...patch }), null);
  }
});

test("Product write enforces database precision for packaging quantities and prices", () => {
  for (const packagingRow of [
    { parentUnit: "box", childQuantity: "1.0001", childUnit: "tablet", barcode: "", sellPrice: "" },
    { parentUnit: "box", childQuantity: "100000000000", childUnit: "tablet", barcode: "", sellPrice: "" },
    { parentUnit: "box", childQuantity: "10", childUnit: "tablet", barcode: "", sellPrice: "12.345" },
    { parentUnit: "box", childQuantity: "10", childUnit: "tablet", barcode: "", sellPrice: "1000000000000" },
  ]) {
    assert.equal(parseProductWriteRequest({
      ...validProduct(),
      packagingRows: [packagingRow],
    }), null);
  }
});

test("Product write validates every item in a bulk request atomically", () => {
  const parsed = parseProductWriteRequest({ items: [validProduct(), {
    ...validProduct(),
    barcode: "8850000000100",
  }] });
  assert.ok(parsed);
  assert.equal(parsed.mode, "bulk");
  assert.equal(parsed.items.length, 2);

  assert.equal(parseProductWriteRequest({ items: [validProduct(), {
    ...validProduct(),
    sellPrice: "invalid",
  }] }), null);
  assert.equal(parseProductWriteRequest({ items: [] }), null);
});

test("Product identity helper supports legacy commands without a physical barcode", () => {
  const command = { barcodes: [] };

  assert.deepEqual(resolveProductWriteIdentity(command, null, () => "abc-123"), {
    id: "p-abc-123",
    barcode: "PHARM-ABC-123",
    aliases: [],
  });
  assert.deepEqual(resolveProductWriteIdentity(command, {
    id: "existing-product",
    barcode: "8850000000999",
  }, () => "unused"), {
    id: "existing-product",
    barcode: "8850000000999",
    aliases: [],
  });
});


test("Product write infers dosage form and repairs only tablet-capsule unit conflicts", () => {
  const parsed = parseProductWriteRequest({
    ...validProduct(),
    itemName: "CLINDAMYCIN CAPSULE 300MG",
    dosageForm: "Unclassified",
    subUnit: "tablet",
  });
  assert.ok(parsed);

  assert.deepEqual(resolveProductWriteDosage(
    parsed.items[0],
    null,
    "Anti-infective Medicines",
    false,
  ), {
    dosageForm: "Capsule",
    dosageFormSource: "INFERRED",
    childUnit: "capsule",
  });

  const boxed = parseProductWriteRequest({
    ...validProduct(),
    itemName: "BOCYTIN CAPSULE 375MG",
    dosageForm: "Unclassified",
    subUnit: "box",
  });
  assert.ok(boxed);
  assert.equal(
    resolveProductWriteDosage(boxed.items[0], null, "Other Medicines & Health Products", false).childUnit,
    "box",
  );
});

test("Product write preserves an existing manual dosage form", () => {
  const parsed = parseProductWriteRequest({
    ...validProduct(),
    itemName: "EXAMPLE OINTMENT 5G",
    dosageForm: "Cream",
    subUnit: "g",
  });
  assert.ok(parsed);

  assert.deepEqual(resolveProductWriteDosage(
    parsed.items[0],
    {
      dosageForm: "Cream",
      dosageFormSource: "MANUAL",
      migrationGenericName: null,
    },
    "Dermatological Medicines",
    true,
  ), {
    dosageForm: "Cream",
    dosageFormSource: "MANUAL",
    childUnit: "g",
  });
});
