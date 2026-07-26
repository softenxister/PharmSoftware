import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCwStockCsv } from "./cwStockNormalizer";

const header = "ลำดับ,Active,รหัสสินค้า,บาร์โค้ด,ชื่อสินค้า(เต็ม),หน่วยฐาน,ชื่อสามัญ,กลุ่มสินค้า,ราคาทุนรับหลังสุด,หน่วยสินค้า,จำนวนคงเหลือ,ราคาปลีก 1,กลุ่มใบอนุญาต,บริษัทผลิต";

test("normalizes a base unit and parent unit using quantity in base units", () => {
  const csv = [
    header,
    "1,True,P-100,ซอง[1]: 111,Example,ซอง,Ingredient,Medicine,10,ซอง[1]: 1,48,ซอง[1]: 5,ข.ย.9,SPR-1: Maker",
    ",,,กล่อง[24]: 222,,,,,,กล่อง[24]: 24,,กล่อง[24]: 110,,",
  ].join("\n");

  const result = normalizeCwStockCsv(csv);

  assert.equal(result.products.length, 1);
  assert.equal(result.units.length, 2);
  assert.equal(result.products[0].externalProductCode, "P-100");
  assert.equal(result.products[0].baseBarcode, "111");
  assert.equal(result.products[0].barcodeDisplay, "ซอง[1] : 111 | กล่อง[24] : 222");
  assert.deepEqual(result.prismaImportPreview[0].parentPacks[0], {
    packUnit: "กล่อง",
    childPackUnit: "ซอง",
    childPackQuantity: 24,
    label: "1 กล่อง = 24 ซอง",
    priceMultiplier: 24,
    barcode: "222",
    sellPriceThb: 110,
  });
});

test("keeps additional barcodes as aliases instead of discarding them", () => {
  const csv = [
    header,
    "1,True,P-2,กล่อง[1]: 111,Example,กล่อง,,,10,กล่อง[1]: 1,2,กล่อง[1]: 60,,Maker",
    ",,,\"แพ็ค[10]: 222, 333\",,,,,,แพ็ค[10]: 10,,แพ็ค[10]: 578,,",
  ].join("\n");

  const result = normalizeCwStockCsv(csv);

  assert.deepEqual(result.units[1].barcodes, ["222", "333"]);
  assert.deepEqual(result.prismaImportPreview[0].barcodeAliases, [{
    barcode: "333",
    unitName: "แพ็ค",
    quantityInBaseUnit: 10,
  }]);
  assert.deepEqual(result.warnings, []);
});

test("merges repeated package definitions and keeps their barcodes as aliases", () => {
  const csv = [
    header,
    "1,True,P-1,ขวด[1]: 111,Example,ขวด,,,10,ขวด[1]: 1,2,ขวด[1]: 60,,Maker",
    ",,,กล่อง[12]: 222,,,,,,กล่อง[12]: 12,,กล่อง[12]: 650,,",
    ",,,กล่อง[12]: 333,,,,,,กล่อง[12]: 12,,กล่อง[12]: 650,,",
  ].join("\n");

  const result = normalizeCwStockCsv(csv);

  assert.equal(result.units.length, 2);
  assert.deepEqual(result.units[1].barcodes, ["222", "333"]);
  assert.equal(result.prismaImportPreview[0].parentPacks.length, 1);
  assert.deepEqual(result.prismaImportPreview[0].barcodeAliases, [{
    barcode: "333",
    unitName: "กล่อง",
    quantityInBaseUnit: 12,
  }]);
});

test("rejects conflicting prices for the same repeated package definition", () => {
  const csv = [
    header,
    "1,True,P-1,ขวด[1]: 111,Example,ขวด,,,10,ขวด[1]: 1,2,ขวด[1]: 60,,Maker",
    ",,,กล่อง[12]: 222,,,,,,กล่อง[12]: 12,,กล่อง[12]: 650,,",
    ",,,กล่อง[12]: 333,,,,,,กล่อง[12]: 12,,กล่อง[12]: 700,,",
  ].join("\n");

  assert.throws(() => normalizeCwStockCsv(csv), /conflicting prices/i);
});

test("deduplicates the same barcode repeated within one product unit", () => {
  const csv = [
    header,
    "1,True,P-788,\"ขวด[1]: 8853174003245, 8853174003245\",COUGO SYRUP 60ML.,ขวด,,,10,ขวด[1]: 1,2,ขวด[1]: 60,,Maker",
  ].join("\n");

  const result = normalizeCwStockCsv(csv);

  assert.deepEqual(result.units[0].barcodes, ["8853174003245"]);
  assert.equal(result.products[0].barcodeDisplay, "ขวด[1] : 8853174003245");
});

test("still rejects one barcode assigned to different package quantities", () => {
  const csv = [
    header,
    "1,True,P-1,ขวด[1]: 111,Example,ขวด,,,10,ขวด[1]: 1,2,ขวด[1]: 60,,Maker",
    ",,,กล่อง[12]: 111,,,,,,กล่อง[12]: 12,,กล่อง[12]: 650,,",
  ].join("\n");

  assert.throws(() => normalizeCwStockCsv(csv), /barcode '111' is already used by P-1/);
});

test("rejects a bracket quantity that disagrees with the unit quantity", () => {
  const csv = [
    header,
    "1,True,P-1,กล่อง[24]: 111,Example,กล่อง,,,10,กล่อง[24]: 1,2,กล่อง[24]: 60,,Maker",
  ].join("\n");

  assert.throws(() => normalizeCwStockCsv(csv), /bracket quantity/);
});

test("extracts a canonical brand instead of copying the full item name", () => {
  const csv = [
    header,
    "1,True,P-3M,ซอง[1]: 111,3M NEXCARE COOLING FEVER ผู้ใหญ่ 6ชิ้น,ซอง,,,10,ซอง[1]: 1,2,ซอง[1]: 60,,Maker",
  ].join("\n");

  const result = normalizeCwStockCsv(csv);
  assert.equal(result.products[0].brandName, "3M");
  assert.equal(result.products[0].brandConfidence, "high");
  assert.equal(result.prismaImportPreview[0].product.brandName, "3M");
});
