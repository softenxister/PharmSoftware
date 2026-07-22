export const MAX_DISTRIBUTOR_DATA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DISTRIBUTOR_DATA_REQUEST_BYTES = MAX_DISTRIBUTOR_DATA_UPLOAD_BYTES + 128 * 1024;

type UploadMetadata = {
  name: string;
  size: number;
  type: string;
};

export function validateDistributorDataUpload(file: UploadMetadata): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
    return "Choose an XLSX or CSV distributor file.";
  }
  if (file.size === 0) return "The selected distributor file is empty.";
  if (file.size > MAX_DISTRIBUTOR_DATA_UPLOAD_BYTES) {
    return "The distributor file must be 5 MB or smaller.";
  }
  return null;
}
