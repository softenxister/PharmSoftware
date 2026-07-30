const MAX_MEMBER_DATA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_MEMBER_DATA_REQUEST_BYTES = MAX_MEMBER_DATA_UPLOAD_BYTES + 128 * 1024;

type UploadMetadata = {
  name: string;
  size: number;
  type: string;
};

export function decodeUtf8MemberDataUpload(bytes: Uint8Array): string {
  const content = bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf
    ? bytes.subarray(3)
    : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new Error("The member CSV must use UTF-8 encoding.");
  }
}

export function validateMemberDataUpload(file: UploadMetadata): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Choose a member CSV file.";
  if (file.size === 0) return "The selected CSV file is empty.";
  if (file.size > MAX_MEMBER_DATA_UPLOAD_BYTES) return "The CSV file must be 5 MB or smaller.";
  return null;
}
