const MAX_CUSTOMER_PURCHASE_HISTORY_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CUSTOMER_PURCHASE_HISTORY_REQUEST_BYTES =
  MAX_CUSTOMER_PURCHASE_HISTORY_UPLOAD_BYTES + 128 * 1024;

type UploadMetadata = {
  name: string;
  size: number;
  type: string;
};

export function validateCustomerPurchaseHistoryUpload(file: UploadMetadata): string | null {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return "Choose a customer purchase-history XLSX file.";
  }
  if (file.size === 0) return "The selected XLSX file is empty.";
  if (file.size > MAX_CUSTOMER_PURCHASE_HISTORY_UPLOAD_BYTES) {
    return "The XLSX file must be 5 MB or smaller.";
  }
  return null;
}
