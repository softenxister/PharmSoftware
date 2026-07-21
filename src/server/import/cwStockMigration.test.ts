import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCwStockMigrationPreview,
  createCwConfirmationToken,
  type CwExistingProductIdentity,
} from "./cwStockMigration";

const cwCsv = `ลำดับ,Active,รหัสสินค้า,บาร์โค้ด,ชื่อสินค้า(เต็ม),หน่วยฐาน,ชื่อสามัญ,กลุ่มสินค้า,ราคาทุนรับหลังสุด,หน่วยสินค้า,จำนวนคงเหลือ,ราคาปลีก 1,กลุ่มใบอนุญาต,บริษัทผลิต
1,True,P-100,ซอง[1]: 111,Matched item,ซอง,,ยา,10,ซอง[1]: 1,48,ซอง[1]: 5,,SPR-1: Maker
,,,กล่อง[20]: 112,,,,,,กล่อง[20]: 20,,กล่อง[20]: 95,,
2,True,P-200,ขวด[1]: 222,New item,ขวด,,ยา,20,ขวด[1]: 1,7,ขวด[1]: 40,,SPR-2: Maker`;

function existing(overrides: Partial<CwExistingProductIdentity> = {}): CwExistingProductIdentity {
  return {
    id: "existing-1",
    externalProductCode: null,
    itemName: "Existing item",
    barcodes: ["111"],
    ...overrides,
  };
}

test("first CW migration matches an existing product by any barcode and creates unmatched products", () => {
  const preview = buildCwStockMigrationPreview(cwCsv, [existing()]);

  assert.deepEqual(preview.summary, {
    totalRows: 2,
    totalUnits: 3,
    newCount: 1,
    updateCount: 1,
    conflictCount: 0,
    brandReviewCount: 0,
  });
  assert.equal(preview.rows[0].status, "update");
  assert.equal(preview.rows[0].matchedProductId, "existing-1");
  assert.equal(preview.rows[1].status, "new");
});

test("future CW migrations match by external product code", () => {
  const preview = buildCwStockMigrationPreview(cwCsv, [existing({
    externalProductCode: "P-100",
    barcodes: ["999"],
  })]);

  assert.equal(preview.rows[0].status, "update");
  assert.equal(preview.rows[0].matchReason, "externalProductCode");
});

test("a row is blocked when its barcodes point to different existing products", () => {
  const preview = buildCwStockMigrationPreview(cwCsv, [
    existing({ id: "existing-1", barcodes: ["111"] }),
    existing({ id: "existing-2", barcodes: ["112"] }),
  ]);

  assert.equal(preview.rows[0].status, "conflict");
  assert.match(preview.rows[0].issue ?? "", /multiple existing products/i);
  assert.equal(preview.summary.conflictCount, 1);
});

test("an external-code match is blocked if an uploaded barcode belongs to another product", () => {
  const preview = buildCwStockMigrationPreview(cwCsv, [
    existing({ id: "existing-1", externalProductCode: "P-100", barcodes: ["111"] }),
    existing({ id: "existing-2", barcodes: ["112"] }),
  ]);

  assert.equal(preview.rows[0].status, "conflict");
  assert.match(preview.rows[0].issue ?? "", /another product/i);
});

test("confirmation tokens are stable for the exact uploaded bytes", () => {
  assert.equal(createCwConfirmationToken(cwCsv), createCwConfirmationToken(cwCsv));
  assert.notEqual(createCwConfirmationToken(cwCsv), createCwConfirmationToken(`${cwCsv}\n`));
});

test("preview confirmation changes when database reconciliation changes", () => {
  const matched = buildCwStockMigrationPreview(cwCsv, [existing()]);
  const unmatched = buildCwStockMigrationPreview(cwCsv, [existing({ barcodes: ["999"] })]);

  assert.notEqual(matched.confirmationToken, unmatched.confirmationToken);
});

test("duplicate uploaded barcodes fail validation before import", () => {
  const duplicateCsv = cwCsv.replace("ขวด[1]: 222", "ขวด[1]: 111");
  assert.throws(
    () => buildCwStockMigrationPreview(duplicateCsv, []),
    /already used by P-100/i,
  );
});

test("preview exposes every base and larger unit with barcodes and price", () => {
  const preview = buildCwStockMigrationPreview(cwCsv, []);
  const units = (preview.rows[0] as unknown as { units?: unknown[] }).units;

  assert.deepEqual(units, [
    {
      unitName: "ซอง",
      quantityInBaseUnit: 1,
      isBaseUnit: true,
      barcodes: ["111"],
      sellPriceThb: 5,
    },
    {
      unitName: "กล่อง",
      quantityInBaseUnit: 20,
      isBaseUnit: false,
      barcodes: ["112"],
      sellPriceThb: 95,
    },
  ]);
});
