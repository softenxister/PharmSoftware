import assert from "node:assert/strict";
import test from "node:test";
import {
  extractDistributorSourceRows,
  prepareDistributorDataMigration,
  type ExistingDistributorIdentity,
} from "./distributorDataMigration";

function storedZip(entries: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + contentBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(contentBytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

function inlineCell(reference: string, value: string): string {
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
}

function cwWorkbook(): Uint8Array {
  const sheet = `<?xml version="1.0" encoding="utf-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="2">${inlineCell("A2", "รายชื่อบริษัทจำหน่าย")}</row>
      <row r="7">${inlineCell("B7", "รหัส")}${inlineCell("C7", "ชื่อ")}${inlineCell("G7", "ที่อยู่")}</row>
      <row r="8">${inlineCell("B8", " SPR-1 ")}${inlineCell("C8", " บริษัท อ้วยอันโอสถ จำกัด ")}${inlineCell("G8", "Address Phone:024541891 Contact:คุณอาคม")}</row>
      <row r="9">${inlineCell("B9", "SPR-2")}${inlineCell("C9", "ZIGMA TRADING CO.,LTD.*")}${inlineCell("G9", "Phone:086-3067612")}</row>
    </sheetData></worksheet>`;
  return storedZip({ "xl/worksheets/sheet1.xml": sheet });
}

function existing(overrides: Partial<ExistingDistributorIdentity> = {}): ExistingDistributorIdentity {
  return { id: "distributor-existing", code: null, name: "บริษัท อ้วยอันโอสถ จำกัด", ...overrides };
}

test("CW XLSX extraction discovers headers and returns only distributor code and name", () => {
  assert.deepEqual(extractDistributorSourceRows("Spl_Items.xlsx", cwWorkbook()), [
    { rowNumber: 8, code: "SPR-1", name: "บริษัท อ้วยอันโอสถ จำกัด" },
    { rowNumber: 9, code: "SPR-2", name: "ZIGMA TRADING CO.,LTD.*" },
  ]);
});

test("UTF-8 CSV extraction discovers the same headers after report preamble rows", () => {
  const csv = [
    "CW distributor report",
    "generated,2026-07-22",
    "ลำดับ,รหัส,ชื่อ,ที่อยู่",
    '1,SPR-1,บริษัท อ้วยอันโอสถ จำกัด,"Address, Phone:024541891"',
  ].join("\n");

  assert.deepEqual(extractDistributorSourceRows("Spl_Items.csv", new TextEncoder().encode(csv)), [
    { rowNumber: 4, code: "SPR-1", name: "บริษัท อ้วยอันโอสถ จำกัด" },
  ]);
});

test("malformed or encrypted XLSX entries are rejected as safe file errors", () => {
  const corruptCompression = cwWorkbook().slice();
  const corruptView = new DataView(corruptCompression.buffer);
  corruptView.setUint16(8, 8, true);
  let centralOffset = 0;
  for (let index = 0; index <= corruptCompression.length - 4; index += 1) {
    if (corruptView.getUint32(index, true) === 0x02014b50) {
      centralOffset = index;
      break;
    }
  }
  assert.ok(centralOffset > 0);
  corruptView.setUint16(centralOffset + 10, 8, true);
  assert.throws(
    () => extractDistributorSourceRows("Spl_Items.xlsx", corruptCompression),
    /XLSX compressed entry is invalid/i,
  );

  const encrypted = cwWorkbook().slice();
  const encryptedView = new DataView(encrypted.buffer);
  encryptedView.setUint16(6, 1, true);
  centralOffset = 0;
  for (let index = 0; index <= encrypted.length - 4; index += 1) {
    if (encryptedView.getUint32(index, true) === 0x02014b50) {
      centralOffset = index;
      break;
    }
  }
  encryptedView.setUint16(centralOffset + 8, 1, true);
  assert.throws(
    () => extractDistributorSourceRows("Spl_Items.xlsx", encrypted),
    /Encrypted XLSX files are not supported/i,
  );
});

test("distributor reconciliation attaches code by exact name and updates by code", () => {
  const rows = extractDistributorSourceRows("Spl_Items.xlsx", cwWorkbook());
  const prepared = prepareDistributorDataMigration(rows, [
    existing(),
    existing({ id: "distributor-code", code: "SPR-2", name: "Old Zigma Name" }),
  ], new Uint8Array([1, 2, 3]));

  assert.deepEqual(prepared.preview.rows.map((row) => row.status), ["update", "update"]);
  assert.deepEqual(prepared.preview.rows.map((row) => row.matchReason), ["name", "code"]);
  assert.equal(prepared.preview.summary.updateCount, 2);
  assert.equal(prepared.preview.summary.conflictCount, 0);
});

test("duplicate and ambiguous distributor identities block only affected rows", () => {
  const rows = [
    { rowNumber: 8, code: "SPR-1", name: "One" },
    { rowNumber: 9, code: " SPR-1 ", name: "Two" },
    { rowNumber: 10, code: "SPR-3", name: "Taken Name" },
    { rowNumber: 11, code: "SPR-4", name: "New Four" },
  ];
  const prepared = prepareDistributorDataMigration(rows, [
    existing({ id: "by-code", code: "SPR-3", name: "Different Name" }),
    existing({ id: "by-name", code: "SPR-99", name: "Taken Name" }),
  ], new Uint8Array([4, 5, 6]));

  assert.deepEqual(prepared.preview.rows.map((row) => row.status), ["conflict", "conflict", "conflict", "new"]);
  assert.match(prepared.preview.rows[0].issue ?? "", /duplicate distributor code/i);
  assert.match(prepared.preview.rows[2].issue ?? "", /different existing distributors/i);
  assert.equal(prepared.preview.summary.newCount, 1);
});
