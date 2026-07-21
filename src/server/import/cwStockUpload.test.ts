import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCwStockCsv } from "./cwStockNormalizer";
import { decodeCwStockUpload, validateCwStockUpload } from "./cwStockUpload";

const validCsv = `ลำดับ,Active,รหัสสินค้า,บาร์โค้ด,ชื่อสินค้า(เต็ม),หน่วยฐาน,ชื่อสามัญ,กลุ่มสินค้า,ราคาทุนรับหลังสุด,หน่วยสินค้า,จำนวนคงเหลือ,ราคาปลีก 1,กลุ่มใบอนุญาต,บริษัทผลิต
1,True,P-100,ชิ้น[1]: 111,สินค้าทดสอบ,ชิ้น,,ยา,10,ชิ้น[1]: 1,5,ชิ้น[1]: 20,,บริษัททดสอบ`;

function encodeWindows874(text: string): Uint8Array {
  const byteByCharacter = new Map<string, number>();
  const decoder = new TextDecoder("windows-874");
  for (let byte = 0; byte <= 255; byte += 1) {
    const character = decoder.decode(Uint8Array.of(byte));
    if (character !== "\uFFFD") byteByCharacter.set(character, byte);
  }
  return Uint8Array.from([...text].map((character) => {
    const byte = byteByCharacter.get(character);
    if (byte === undefined) throw new Error(`Character is unavailable in Windows-874: ${character}`);
    return byte;
  }));
}

function encodeUtf16Le(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    bytes[index * 2] = codeUnit & 0xff;
    bytes[index * 2 + 1] = codeUnit >> 8;
  }
  return bytes;
}

test("CW stock upload accepts a non-empty CSV file", () => {
  assert.equal(validateCwStockUpload({ name: "stock.csv", size: 420, type: "text/csv" }), null);
});

test("CW stock upload rejects unsupported, empty, and oversized files", () => {
  assert.match(validateCwStockUpload({ name: "stock.xlsx", size: 420, type: "application/vnd.ms-excel" }) ?? "", /CSV/i);
  assert.match(validateCwStockUpload({ name: "stock.csv", size: 0, type: "text/csv" }) ?? "", /empty/i);
  assert.match(validateCwStockUpload({ name: "stock.csv", size: 5 * 1024 * 1024 + 1, type: "text/csv" }) ?? "", /5 MB/i);
});

test("CW stock upload decodes Thai Excel CSV encodings before normalization", () => {
  const windows874 = normalizeCwStockCsv(decodeCwStockUpload(encodeWindows874(validCsv)));
  const utf16Le = normalizeCwStockCsv(decodeCwStockUpload(encodeUtf16Le(validCsv)));

  assert.equal(windows874.products[0].itemName, "สินค้าทดสอบ");
  assert.equal(utf16Le.products[0].itemName, "สินค้าทดสอบ");
});

test("CW stock upload keeps UTF-8 and UTF-8 BOM exports unchanged", () => {
  const utf8 = new TextEncoder().encode(validCsv);
  assert.equal(decodeCwStockUpload(utf8), validCsv);
  assert.equal(decodeCwStockUpload(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8])), validCsv);
});
