import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLotExpiryItems,
  normalizeLotExpiryRows,
  prepareLotExpiryMigration,
  type ExistingLotExpiryProduct,
  type SpreadsheetRow,
} from "./lotExpiryMigration";

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
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
}

function lotWorkbook(): Uint8Array {
  const sheet = `<?xml version="1.0" encoding="utf-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="8">${inlineCell("A8", "ลำดับ")}${inlineCell("B8", "สินค้า")}${inlineCell("K8", "จำนวน")}${inlineCell("N8", "หน่วย")}</row>
      <row r="10">${inlineCell("A10", "1")}${inlineCell("B10", "P-100: Example")}${inlineCell("K10", "5")}${inlineCell("N10", "กล่อง")}</row>
      <row r="11">${inlineCell("B11", "LOT-RECEIPT")}${inlineCell("C11", "\u00a0")}${inlineCell("H11", "12/03/2027")}${inlineCell("K11", "3")}${inlineCell("N11", "กล่อง")}</row>
    </sheetData></worksheet>`;
  return storedZip({ "xl/worksheets/sheet1.xml": sheet });
}

function row(rowNumber: number, values: Record<string, string>): SpreadsheetRow {
  return { rowNumber, values: new Map(Object.entries(values)) };
}

function existing(
  overrides: Partial<ExistingLotExpiryProduct> = {},
): ExistingLotExpiryProduct {
  return {
    id: "product-100",
    externalProductCode: "P-100",
    itemName: "Existing product",
    baseUnit: "กล่อง",
    sellPriceThb: 45,
    ...overrides,
  };
}

test("normalization creates a blank lot and expiry remainder without changing dated batches", () => {
  const normalized = normalizeLotExpiryRows([
    row(10, {
      A: "1",
      B: "P-100: Example product",
      K: "10",
      N: "กล่อง",
    }),
    row(11, {
      B: "LOT-RECEIPT-1\nLOT-RECEIPT-2\nLOT-RECEIPT-3",
      C: "LOT-A\n\u00a0\nLOT-C",
      H: "12/03/2027\n12/03/2027\n01/04/2027",
      K: "2\n3\n1",
      N: "กล่อง\nกล่อง\nกล่อง",
    }),
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].reportedAmount, 10);
  assert.equal(normalized[0].remainderAmount, 4);
  assert.deepEqual(normalized[0].batches, [
    {
      lotNo: "LOT-A",
      expiryDate: "2027-03-12",
      amount: 2,
      unit: "กล่อง",
      generatedLotNo: false,
      sourceRows: [11],
    },
    {
      lotNo: "240312",
      expiryDate: "2027-03-12",
      amount: 3,
      unit: "กล่อง",
      generatedLotNo: true,
      sourceRows: [11],
    },
    {
      lotNo: "LOT-C",
      expiryDate: "2027-04-01",
      amount: 1,
      unit: "กล่อง",
      generatedLotNo: false,
      sourceRows: [11],
    },
    {
      lotNo: "",
      expiryDate: "",
      amount: 4,
      unit: "กล่อง",
      generatedLotNo: false,
      sourceRows: [10],
    },
  ]);
});

test("a remainder does not change either lot when the latest expiry date is tied", () => {
  const [normalized] = normalizeLotExpiryRows([
    row(20, { A: "2", B: "P-200: Tied expiry", M: "8", N: "ขวด" }),
    row(21, {
      C: "LOT-FIRST\nLOT-LAST",
      H: "01/05/2028\n01/05/2028",
      M: "2\n3",
      N: "ขวด\nขวด",
    }),
  ]);

  assert.deepEqual(normalized.batches.map(({ lotNo, amount }) => ({ lotNo, amount })), [
    { lotNo: "LOT-FIRST", amount: 2 },
    { lotNo: "LOT-LAST", amount: 3 },
    { lotNo: "", amount: 3 },
  ]);
});

test("equal lot and expiry rows aggregate while equal lots with different expiry remain separate", () => {
  const [normalized] = normalizeLotExpiryRows([
    row(30, { A: "3", B: "P-300: Duplicate lots", M: "9", N: "แผง" }),
    row(31, {
      C: "ABC\nABC\nABC",
      H: "01/06/2028\n01/06/2028\n01/07/2028",
      M: "2\n3\n4",
      N: "แผง\nแผง\nแผง",
    }),
  ]);

  assert.deepEqual(normalized.batches.map(({ lotNo, expiryDate, amount }) => ({
    lotNo,
    expiryDate,
    amount,
  })), [
    { lotNo: "ABC", expiryDate: "2028-06-01", amount: 5 },
    { lotNo: "ABC", expiryDate: "2028-07-01", amount: 4 },
  ]);
});

test("preview imports matched products and reports unmatched product codes without blocking matches", () => {
  const normalized = normalizeLotExpiryRows([
    row(10, { A: "1", B: "P-100: Matched", M: "2", N: "กล่อง" }),
    row(11, { C: "A", H: "01/01/2028", M: "2", N: "กล่อง" }),
    row(13, { A: "2", B: "P-999: Missing", M: "1", N: "ขวด" }),
    row(14, { C: "B", H: "01/02/2028", M: "1", N: "ขวด" }),
  ]);

  const prepared = prepareLotExpiryMigration(
    normalized,
    [existing()],
    new TextEncoder().encode("same uploaded workbook"),
  );

  assert.deepEqual(prepared.preview.summary, {
    totalProducts: 2,
    matchedProducts: 1,
    unmatchedProducts: 1,
    conflictProducts: 0,
    totalBatches: 2,
    generatedLotCount: 0,
    remainderProducts: 0,
  });
  assert.equal(prepared.preview.rows[0].status, "unmatched");
  assert.match(prepared.preview.rows[0].issue ?? "", /P-999/);
  assert.equal(prepared.preview.rows[1].status, "matched");
  assert.equal(prepared.preview.rows[1].matchedProductId, "product-100");
  assert.deepEqual(prepared.importRows.map((item) => item.externalProductCode), ["P-100"]);
});

test("preview sorts unmatched and blocked unit conflicts before matched products", () => {
  const normalized = normalizeLotExpiryRows([
    row(10, { A: "1", B: "P-100: Matched", M: "1", N: "กล่อง" }),
    row(11, { C: "A", H: "01/01/2028", M: "1", N: "กล่อง" }),
    row(13, { A: "2", B: "P-200: Unit conflict", M: "1", N: "กล่อง" }),
    row(14, { C: "B", H: "01/02/2028", M: "1", N: "กล่อง" }),
    row(16, { A: "3", B: "P-999: Unmatched", M: "1", N: "ขวด" }),
    row(17, { C: "C", H: "01/03/2028", M: "1", N: "ขวด" }),
  ]);

  const prepared = prepareLotExpiryMigration(
    normalized,
    [
      existing({ id: "product-100", externalProductCode: "P-100", baseUnit: "box" }),
      existing({ id: "product-200", externalProductCode: "P-200", baseUnit: "bottle" }),
    ],
    new TextEncoder().encode("sorted preview"),
  );

  assert.deepEqual(
    prepared.preview.rows.map((item) => [item.externalProductCode, item.status]),
    [
      ["P-999", "unmatched"],
      ["P-200", "conflict"],
      ["P-100", "matched"],
    ],
  );
});

test("preview matches Thai and English aliases of the same normalized product unit", () => {
  const normalized = normalizeLotExpiryRows([
    row(10, { A: "1", B: "P-100: Sachet", M: "2", N: "ซอง" }),
    row(11, { C: "A", H: "01/01/2028", M: "2", N: "ซอง" }),
    row(13, { A: "2", B: "P-200: Piece", M: "1", N: "อัน" }),
    row(14, { C: "B", H: "01/02/2028", M: "1", N: "อัน" }),
  ]);

  const prepared = prepareLotExpiryMigration(
    normalized,
    [
      existing({ id: "product-100", externalProductCode: "P-100", baseUnit: "sachet" }),
      existing({ id: "product-200", externalProductCode: "P-200", baseUnit: "piece" }),
    ],
    new TextEncoder().encode("unit aliases"),
  );

  assert.deepEqual(prepared.preview.rows.map((item) => item.status), ["matched", "matched"]);
  assert.equal(prepared.preview.summary.conflictProducts, 0);
});

test("preview confirmation changes when database matching changes", () => {
  const normalized = normalizeLotExpiryRows([
    row(10, { A: "1", B: "P-100: Example", M: "1", N: "กล่อง" }),
    row(11, { C: "A", H: "01/01/2028", M: "1", N: "กล่อง" }),
  ]);
  const bytes = new TextEncoder().encode("same workbook");

  const matched = prepareLotExpiryMigration(normalized, [existing()], bytes);
  const unmatched = prepareLotExpiryMigration(normalized, [], bytes);

  assert.notEqual(matched.preview.confirmationToken, unmatched.preview.confirmationToken);
});

test("normalization rejects detail amounts above the item amount", () => {
  assert.throws(
    () => normalizeLotExpiryRows([
      row(10, { A: "1", B: "P-100: Example", M: "2", N: "กล่อง" }),
      row(11, { C: "A", H: "01/01/2028", M: "3", N: "กล่อง" }),
    ]),
    /exceeds the item amount/i,
  );
});

test("normalization rejects extra lot lines that do not align with expiry details", () => {
  assert.throws(
    () => normalizeLotExpiryRows([
      row(10, { A: "1", B: "P-100: Example", M: "2", N: "กล่อง" }),
      row(11, {
        C: "LOT-A\nLOT-B",
        H: "01/01/2028",
        M: "2",
        N: "กล่อง",
      }),
    ]),
    /do not align/i,
  );
});

test("normalization preserves a leading blank lot placeholder from CW", () => {
  const [normalized] = normalizeLotExpiryRows([
    row(10, { A: "1", B: "P-100: Example", M: "5", N: "กล่อง" }),
    row(11, {
      C: "\u00a0\nLOT-B",
      H: "01/01/2028\n01/02/2028",
      M: "2\n3",
      N: "กล่อง\nกล่อง",
    }),
  ]);

  assert.deepEqual(normalized.batches.map((batch) => batch.lotNo), ["250101", "LOT-B"]);
});

test("XLSX extraction reads inline CW cells and the merged K:M amount anchor", () => {
  assert.deepEqual(extractLotExpiryItems("StockBal_MfgExp.xlsx", lotWorkbook()), [
    {
      sourceRow: 10,
      sequence: 1,
      externalProductCode: "P-100",
      itemName: "Example",
      reportedAmount: 5,
      unit: "กล่อง",
      remainderAmount: 2,
      batches: [
        {
          lotNo: "240312",
          expiryDate: "2027-03-12",
          amount: 3,
          unit: "กล่อง",
          generatedLotNo: true,
          sourceRows: [11],
        },
        {
          lotNo: "",
          expiryDate: "",
          amount: 2,
          unit: "กล่อง",
          generatedLotNo: false,
          sourceRows: [10],
        },
      ],
    },
  ]);
});

test("XLSX extraction rejects non-XLSX content", () => {
  assert.throws(
    () => extractLotExpiryItems("StockBal_MfgExp.xlsx", new TextEncoder().encode("not a zip")),
    /valid ZIP workbook/i,
  );
});

test("XLSX extraction rejects a workbook without the CW lot and expiry headers", () => {
  const worksheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="10">${inlineCell("A10", "1")}${inlineCell("B10", "P-100: Example")}${inlineCell("K10", "1")}${inlineCell("N10", "กล่อง")}</row>
    <row r="11">${inlineCell("C11", "A")}${inlineCell("H11", "01/01/2028")}${inlineCell("K11", "1")}${inlineCell("N11", "กล่อง")}</row>
  </sheetData></worksheet>`;

  assert.throws(
    () => extractLotExpiryItems(
      "StockBal_MfgExp.xlsx",
      storedZip({ "xl/worksheets/sheet1.xml": worksheet }),
    ),
    /required CW headers/i,
  );
});
