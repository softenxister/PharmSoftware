import { CW_STOCK_HEADERS } from "./cwStockNormalizer";

const MAX_CW_STOCK_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CW_STOCK_REQUEST_BYTES = MAX_CW_STOCK_UPLOAD_BYTES + 128 * 1024;

type CwCsvEncoding = "utf-8" | "windows-874" | "utf-16le" | "utf-16be";

type DecodedCandidate = {
  encoding: CwCsvEncoding;
  headerScore: number;
};

function decodeBytes(bytes: Uint8Array, encoding: CwCsvEncoding): string {
  return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, "");
}

function requiredHeaderScore(text: string): number {
  const firstLineEnd = text.search(/[\r\n]/);
  const firstLine = text.slice(0, firstLineEnd === -1 ? text.length : firstLineEnd);
  return CW_STOCK_HEADERS.filter((header) => firstLine.includes(header)).length;
}

function startsWithBytes(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

export function decodeCwStockUpload(bytes: Uint8Array): string {
  if (startsWithBytes(bytes, [0xef, 0xbb, 0xbf])) return decodeBytes(bytes.subarray(3), "utf-8");
  if (startsWithBytes(bytes, [0xff, 0xfe])) return decodeBytes(bytes.subarray(2), "utf-16le");
  if (startsWithBytes(bytes, [0xfe, 0xff])) return decodeBytes(bytes.subarray(2), "utf-16be");

  const probe = bytes.subarray(0, 16 * 1024);
  const candidates: DecodedCandidate[] = ["utf-8", "windows-874", "utf-16le", "utf-16be"]
    .map((encoding) => ({
      encoding: encoding as CwCsvEncoding,
      headerScore: requiredHeaderScore(decodeBytes(probe, encoding as CwCsvEncoding)),
    }));
  const best = candidates.reduce((current, next) => (
    next.headerScore > current.headerScore ? next : current
  ));
  return decodeBytes(bytes, best.encoding);
}

type UploadMetadata = {
  name: string;
  size: number;
  type: string;
};

export function validateCwStockUpload(file: UploadMetadata): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Choose a CW stock CSV file.";
  if (file.size === 0) return "The selected CSV file is empty.";
  if (file.size > MAX_CW_STOCK_UPLOAD_BYTES) return "The CSV file must be 5 MB or smaller.";
  return null;
}
