import { inflateRawSync } from "node:zlib";

export type XlsxWorksheetRow = {
  rowNumber: number;
  values: Map<string, string>;
};

type XlsxReadLimits = {
  maxEntryBytes: number;
  maxExpandedBytes: number;
};

const DEFAULT_LIMITS: XlsxReadLimits = {
  maxEntryBytes: 12 * 1024 * 1024,
  maxExpandedBytes: 24 * 1024 * 1024,
};

const XLSX_WORKSHEET_PATH = "xl/worksheets/sheet1.xml";

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

function unzipEntries(
  bytes: Uint8Array,
  limits: XlsxReadLimits,
): Map<string, Uint8Array> {
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
    if (nextCursor > centralOffset + centralSize || expandedSize > limits.maxEntryBytes) {
      throw new Error("The XLSX file expands beyond the supported limit.");
    }
    if ((flags & 0x1) !== 0) throw new Error("Encrypted XLSX files are not supported.");
    const name = decodeUtf8(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
      "The XLSX file has an invalid entry name.",
    );
    if (
      localOffset >= centralOffset
      || localOffset + 30 > bytes.length
      || view.getUint32(localOffset, true) !== 0x04034b50
    ) {
      throw new Error("The XLSX entry is invalid.");
    }
    const localFlags = view.getUint16(localOffset + 6, true);
    const localCompression = view.getUint16(localOffset + 8, true);
    if (localFlags !== flags || localCompression !== compression) {
      throw new Error("The XLSX entry metadata is invalid.");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) throw new Error("The XLSX entry is incomplete.");
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    let expanded: Uint8Array;
    if (compression === 0) expanded = compressed.slice();
    else if (compression === 8) {
      try {
        expanded = new Uint8Array(inflateRawSync(compressed, {
          maxOutputLength: limits.maxEntryBytes,
        }));
      } catch {
        throw new Error("The XLSX compressed entry is invalid or expands beyond the supported limit.");
      }
    } else {
      throw new Error("The XLSX file uses unsupported ZIP compression.");
    }
    if (expanded.length !== expandedSize) throw new Error("The XLSX entry size is invalid.");
    expandedBytes += expanded.length;
    if (expandedBytes > limits.maxExpandedBytes) {
      throw new Error("The XLSX file expands beyond the supported limit.");
    }
    entries.set(name.replace(/^\//, ""), expanded);
    cursor = nextCursor;
  }
  return entries;
}

function xmlTextRuns(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
    .map((match) => xmlTextRuns(match[1]));
}

function parseWorksheetRows(
  xml: string,
  sharedStrings: readonly string[],
): XlsxWorksheetRow[] {
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

export function readFirstXlsxWorksheet(
  bytes: Uint8Array,
  limits: Partial<XlsxReadLimits> = {},
): XlsxWorksheetRow[] {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("The XLSX file is not a valid ZIP workbook.");
  }
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const entries = unzipEntries(bytes, resolvedLimits);
  const worksheetBytes = entries.get(XLSX_WORKSHEET_PATH);
  if (!worksheetBytes) throw new Error("The XLSX file does not contain the expected worksheet.");
  const sharedBytes = entries.get("xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(
    sharedBytes ? decodeUtf8(sharedBytes, "The XLSX shared strings are invalid UTF-8.") : null,
  );
  const worksheet = decodeUtf8(worksheetBytes, "The XLSX worksheet is invalid UTF-8.");
  return parseWorksheetRows(worksheet, sharedStrings);
}
