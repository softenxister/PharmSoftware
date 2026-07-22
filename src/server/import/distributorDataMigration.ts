import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

const MAX_XLSX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_XLSX_EXPANDED_BYTES = 24 * 1024 * 1024;
const XLSX_WORKSHEET_PATH = "xl/worksheets/sheet1.xml";

export type DistributorSourceRow = {
  rowNumber: number;
  code: string;
  name: string;
};

export type ExistingDistributorIdentity = {
  id: string;
  code: string | null;
  name: string;
};

export type DistributorMigrationStatus = "new" | "update" | "conflict";
export type DistributorMatchReason = "code" | "name" | null;

export type DistributorDataMigrationRow = DistributorSourceRow & {
  status: DistributorMigrationStatus;
  matchReason: DistributorMatchReason;
  matchedDistributorId: string | null;
  matchedDistributorName: string | null;
  issue: string | null;
};

export type DistributorDataMigrationPreview = {
  sourceSoftware: "CW";
  confirmationToken: string;
  summary: {
    totalRows: number;
    newCount: number;
    updateCount: number;
    conflictCount: number;
  };
  rows: DistributorDataMigrationRow[];
};

export type PreparedDistributorDataMigration = {
  preview: DistributorDataMigrationPreview;
  importRows: DistributorDataMigrationRow[];
};

function decodeUtf8(bytes: Uint8Array, errorMessage: string): string {
  const content = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new Error(errorMessage);
  }
}

function decodeXmlText(value: string): string {
  const decodeCodePoint = (code: string, radix: number): string => {
    const codePoint = Number.parseInt(code, radix);
    return Number.isInteger(codePoint)
      && codePoint >= 0
      && codePoint <= 0x10ffff
      && (codePoint < 0xd800 || codePoint > 0xdfff)
      ? String.fromCodePoint(codePoint)
      : "\ufffd";
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => decodeCodePoint(code, 16))
    .replace(/&#(\d+);/g, (_match, code: string) => decodeCodePoint(code, 10))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const earliest = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("XLSX ZIP directory was not found.");
}

function unzipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length < 22) throw new Error("The XLSX file is incomplete.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes, view);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDiskNumber = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (
    diskNumber !== 0
    || centralDiskNumber !== 0
    || entriesOnDisk !== entryCount
    || entryCount > 1_000
    || centralOffset >= bytes.length
    || centralOffset + centralSize > endOffset
  ) {
    throw new Error("The XLSX ZIP directory is invalid or unsupported.");
  }

  const entries = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("The XLSX ZIP directory is invalid.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nextCursor = cursor + 46 + nameLength + extraLength + commentLength;
    if (nextCursor > centralOffset + centralSize || expandedSize > MAX_XLSX_ENTRY_BYTES) {
      throw new Error("The XLSX file expands beyond the supported limit.");
    }
    if ((flags & 0x1) !== 0) throw new Error("Encrypted XLSX files are not supported.");
    const name = decodeUtf8(bytes.subarray(cursor + 46, cursor + 46 + nameLength), "The XLSX file has an invalid entry name.");
    if (localOffset >= centralOffset || localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error("The XLSX entry is invalid.");
    }
    const localFlags = view.getUint16(localOffset + 6, true);
    const localCompression = view.getUint16(localOffset + 8, true);
    if (localFlags !== flags || localCompression !== compression) throw new Error("The XLSX entry metadata is invalid.");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) throw new Error("The XLSX entry is incomplete.");
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    let expanded: Uint8Array;
    if (compression === 0) expanded = compressed.slice();
    else if (compression === 8) {
      try {
        expanded = new Uint8Array(inflateRawSync(compressed, { maxOutputLength: MAX_XLSX_ENTRY_BYTES }));
      } catch {
        throw new Error("The XLSX compressed entry is invalid or expands beyond the supported limit.");
      }
    } else {
      throw new Error("The XLSX file uses unsupported ZIP compression.");
    }
    if (expanded.length !== expandedSize) throw new Error("The XLSX entry size is invalid.");
    expandedBytes += expanded.length;
    if (expandedBytes > MAX_XLSX_EXPANDED_BYTES) throw new Error("The XLSX file expands beyond the supported limit.");
    entries.set(name.replace(/^\//, ""), expanded);
    cursor = nextCursor;
  }
  return entries;
}

function spreadsheetColumnName(index: number): string {
  let value = index + 1;
  let column = "";
  while (value > 0) {
    value -= 1;
    column = String.fromCharCode(65 + (value % 26)) + column;
    value = Math.floor(value / 26);
  }
  return column;
}

function xmlTextRuns(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlTextRuns(match[1]));
}

function parseWorksheetRows(xml: string, sharedStrings: readonly string[]): Array<{ rowNumber: number; values: Map<string, string> }> {
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const rowNumber = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1] ?? 0);
    const values = new Map<string, string>();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = /\br="([A-Z]+)\d+"/.exec(cellMatch[1])?.[1];
      if (!reference) continue;
      const type = /\bt="([^"]+)"/.exec(cellMatch[1])?.[1] ?? "n";
      let value = "";
      if (type === "inlineStr") value = xmlTextRuns(cellMatch[2]);
      else {
        const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] ?? "";
        value = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : decodeXmlText(rawValue);
      }
      values.set(reference, value);
    }
    return { rowNumber, values };
  });
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (quoted) {
      if (character === '"' && csvText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function sourceRowsFromTable(rows: Array<{ rowNumber: number; values: Map<string, string> }>): DistributorSourceRow[] {
  const header = rows.find((row) => (
    [...row.values.values()].some((value) => value.trim() === "รหัส")
    && [...row.values.values()].some((value) => value.trim() === "ชื่อ")
  ));
  if (!header) throw new Error("File is missing required columns: รหัส, ชื่อ");
  const codeColumn = [...header.values].find(([, value]) => value.trim() === "รหัส")?.[0];
  const nameColumn = [...header.values].find(([, value]) => value.trim() === "ชื่อ")?.[0];
  if (!codeColumn || !nameColumn) throw new Error("File is missing required columns: รหัส, ชื่อ");
  return rows
    .filter((row) => row.rowNumber > header.rowNumber)
    .map((row) => ({
      rowNumber: row.rowNumber,
      code: (row.values.get(codeColumn) ?? "").trim(),
      name: (row.values.get(nameColumn) ?? "").trim(),
    }))
    .filter((row) => row.code || row.name);
}

export function extractDistributorSourceRows(fileName: string, bytes: Uint8Array): DistributorSourceRow[] {
  if (fileName.toLowerCase().endsWith(".csv")) {
    const csvRows = parseCsvRows(decodeUtf8(bytes, "The distributor CSV must use UTF-8 encoding."));
    return sourceRowsFromTable(csvRows.map((values, index) => ({
      rowNumber: index + 1,
      values: new Map(values.map((value, columnIndex) => [spreadsheetColumnName(columnIndex), value])),
    })));
  }
  if (!fileName.toLowerCase().endsWith(".xlsx")) throw new Error("Choose an XLSX or CSV distributor file.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("The XLSX file is not a valid ZIP workbook.");
  const entries = unzipEntries(bytes);
  const worksheetBytes = entries.get(XLSX_WORKSHEET_PATH);
  if (!worksheetBytes) throw new Error("The XLSX file does not contain the CW distributor worksheet.");
  const sharedBytes = entries.get("xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedBytes ? decodeUtf8(sharedBytes, "The XLSX shared strings are invalid UTF-8.") : null);
  const worksheet = decodeUtf8(worksheetBytes, "The XLSX worksheet is invalid UTF-8.");
  return sourceRowsFromTable(parseWorksheetRows(worksheet, sharedStrings));
}

function requiredIssue(row: DistributorSourceRow): string | null {
  if (!row.code) return "Distributor code is required.";
  if (row.code.length > 100) return "Distributor code must be 100 characters or fewer.";
  if (!row.name) return "Distributor name is required.";
  if (row.name.length > 200) return "Distributor name must be 200 characters or fewer.";
  return null;
}

export function prepareDistributorDataMigration(
  sourceRows: readonly DistributorSourceRow[],
  existingDistributors: readonly ExistingDistributorIdentity[],
  sourceBytes: Uint8Array,
): PreparedDistributorDataMigration {
  const normalizedRows = sourceRows.map((row) => ({
    ...row,
    code: row.code.trim(),
    name: row.name.trim(),
  }));
  const codeCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    if (row.code) codeCounts.set(row.code, (codeCounts.get(row.code) ?? 0) + 1);
    if (row.name) nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1);
  }
  const existingByCode = new Map(existingDistributors.flatMap((distributor) => (
    distributor.code ? [[distributor.code, distributor] as const] : []
  )));
  const existingByName = new Map(existingDistributors.map((distributor) => [distributor.name, distributor] as const));

  const importRows: DistributorDataMigrationRow[] = normalizedRows.map((row) => {
    const codeMatch = existingByCode.get(row.code) ?? null;
    const nameMatch = existingByName.get(row.name) ?? null;
    let issue = requiredIssue(row);
    if (!issue && (codeCounts.get(row.code) ?? 0) > 1) issue = "Duplicate distributor code in the uploaded file.";
    if (!issue && (nameCounts.get(row.name) ?? 0) > 1) issue = "Duplicate distributor name in the uploaded file.";
    if (!issue && codeMatch && nameMatch && codeMatch.id !== nameMatch.id) {
      issue = "Distributor code and name match different existing distributors.";
    }
    if (!issue && !codeMatch && nameMatch?.code && nameMatch.code !== row.code) {
      issue = `Distributor name is already assigned to code ${nameMatch.code}.`;
    }
    const matched = codeMatch ?? nameMatch;
    return {
      ...row,
      status: issue ? "conflict" : matched ? "update" : "new",
      matchReason: codeMatch ? "code" : nameMatch ? "name" : null,
      matchedDistributorId: matched?.id ?? null,
      matchedDistributorName: matched?.name ?? null,
      issue,
    };
  });

  const reconciliation = importRows.map((row) => ({
    rowNumber: row.rowNumber,
    code: row.code,
    name: row.name,
    status: row.status,
    matchReason: row.matchReason,
    matchedDistributorId: row.matchedDistributorId,
    issue: row.issue,
  }));
  const confirmationToken = createHash("sha256")
    .update(sourceBytes)
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");
  const count = (status: DistributorMigrationStatus) => importRows.filter((row) => row.status === status).length;
  return {
    importRows,
    preview: {
      sourceSoftware: "CW",
      confirmationToken,
      summary: {
        totalRows: importRows.length,
        newCount: count("new"),
        updateCount: count("update"),
        conflictCount: count("conflict"),
      },
      rows: importRows,
    },
  };
}
