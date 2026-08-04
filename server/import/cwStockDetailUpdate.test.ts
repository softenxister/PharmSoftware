import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCwStockDetailRows,
  prepareCwStockDetailUpdate,
  type CwStockDetailExistingProduct,
} from "./cwStockDetailUpdate";

const fullCwCsv = `ลำดับ,Active,รหัสสินค้า,บาร์โค้ด,ชื่อสินค้า(เต็ม),หน่วยฐาน,ชื่อสามัญ,กลุ่มสินค้า,ราคาทุนรับหลังสุด,หน่วยสินค้า,จำนวนคงเหลือ,ราคาปลีก 1,กลุ่มใบอนุญาต,บริษัทผลิต
1,True,P-7784,เม็ด[1]: 111,Name that must be ignored,เม็ด,Paracetamol,ยา,1.25,เม็ด[1]: 1,48,เม็ด[1]: 5,,Maker
,,,กล่อง[100]: 112,,กล่อง,Wrong continuation generic,,999,กล่อง[100]: 100,,กล่อง[100]: 450,,
2,True,P-9000,ขวด[1]: 222,Another ignored name,ขวด,,ยา,,ขวด[1]: 1,7,ขวด[1]: 40,,Maker`;

function existing(overrides: Partial<CwStockDetailExistingProduct> = {}): CwStockDetailExistingProduct {
  return {
    id: "product-7784",
    externalProductCode: "P-7784",
    itemName: "Curated product name",
    migrationGenericName: "Acetaminophen",
    migrationCostThb: 1,
    ...overrides,
  };
}

test("focused update reads generic name and base-unit cost only from the row containing the item code", () => {
  const rows = extractCwStockDetailRows(fullCwCsv);

  assert.deepEqual(rows, [
    {
      sourceRow: 2,
      externalProductCode: "P-7784",
      migrationGenericName: "Paracetamol",
      migrationCostThb: 1.25,
      issue: null,
    },
    {
      sourceRow: 4,
      externalProductCode: "P-9000",
      migrationGenericName: null,
      migrationCostThb: null,
      issue: null,
    },
  ]);
});

test("focused update keeps physical CSV row numbers when blank lines are present", () => {
  const rows = extractCwStockDetailRows(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\n\nP-7784,Paracetamol,1.25`,
  );

  assert.equal(rows[0].sourceRow, 3);
});

test("focused update accepts a three-column file and ignores unrelated full-import fields", () => {
  const csv = `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,Ibuprofen,2.50`;
  const prepared = prepareCwStockDetailUpdate(csv, [existing()]);

  assert.equal(prepared.preview.rows[0].status, "changed");
  assert.equal(prepared.preview.rows[0].matchedItemName, "Curated product name");
  assert.equal(prepared.preview.rows[0].nextGenericName, "Ibuprofen");
  assert.equal(prepared.preview.rows[0].nextCostThb, 2.5);
});

test("focused update accepts latest costs with up to four decimal places", () => {
  const accepted = extractCwStockDetailRows(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,Paracetamol,1.2345`,
  );
  const rejected = extractCwStockDetailRows(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,Paracetamol,1.23456`,
  );

  assert.equal(accepted[0].migrationCostThb, 1.2345);
  assert.equal(accepted[0].issue, null);
  assert.match(rejected[0].issue ?? "", /at most four decimals/);
});

test("focused update matches only exact CW item code and never falls back to name or barcode", () => {
  const prepared = prepareCwStockDetailUpdate(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-OTHER,Paracetamol,1.25`,
    [existing()],
  );

  assert.equal(prepared.preview.rows[0].status, "unmatched");
  assert.equal(prepared.preview.rows[0].matchedProductId, null);
  assert.equal(prepared.importRows.length, 0);
});

test("blank generic name and blank or zero cost preserve existing focused-update values", () => {
  const blank = prepareCwStockDetailUpdate(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,,`,
    [existing()],
  );
  const zero = prepareCwStockDetailUpdate(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,,0.00`,
    [existing()],
  );

  for (const prepared of [blank, zero]) {
    assert.equal(prepared.preview.rows[0].status, "unchanged");
    assert.equal(prepared.preview.rows[0].nextGenericName, "Acetaminophen");
    assert.equal(prepared.preview.rows[0].nextCostThb, 1);
  }
});

test("focused update reports duplicate codes and invalid costs without importing them", () => {
  const prepared = prepareCwStockDetailUpdate(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด\nP-7784,Paracetamol,-1\nP-7784,Paracetamol,abc`,
    [existing()],
  );

  assert.equal(prepared.preview.summary.invalidCount, 2);
  assert.ok(prepared.preview.rows.every((row) => row.status === "invalid"));
  assert.equal(prepared.importRows.length, 0);
});

test("focused preview orders invalid and unmatched rows before unchanged and changed rows", () => {
  const prepared = prepareCwStockDetailUpdate(
    `รหัสสินค้า,ชื่อสามัญ,ราคาทุนรับหลังสุด
P-CHANGE,New generic,2.5000
P-SAME,,
P-INVALID,Generic,not-a-cost
P-MISSING,Generic,1.2500`,
    [
      existing({ id: "product-change", externalProductCode: "P-CHANGE" }),
      existing({ id: "product-same", externalProductCode: "P-SAME" }),
    ],
  );

  assert.deepEqual(
    prepared.preview.rows.map((row) => row.status),
    ["invalid", "unmatched", "unchanged", "changed"],
  );
  assert.deepEqual(
    prepared.preview.rows.map((row) => row.sourceRow),
    [4, 5, 3, 2],
  );
});

test("focused confirmation token changes with matching state and proposed values", () => {
  const first = prepareCwStockDetailUpdate(fullCwCsv, [existing()]);
  const changedTarget = prepareCwStockDetailUpdate(fullCwCsv, [existing({ id: "different-id" })]);
  const changedFile = prepareCwStockDetailUpdate(fullCwCsv.replace("1.25", "1.30"), [existing()]);

  assert.notEqual(first.preview.confirmationToken, changedTarget.preview.confirmationToken);
  assert.notEqual(first.preview.confirmationToken, changedFile.preview.confirmationToken);
});
