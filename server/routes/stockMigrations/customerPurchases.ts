import {
  isAuthenticationError,
  requireStockManager,
} from "@server/auth/pharmUser";
import {
  CustomerPurchaseHistoryConfirmationError,
  importCustomerPurchaseHistoryMigration,
  previewCustomerPurchaseHistoryMigration,
} from "@server/db/migration/customerPurchaseHistoryMigrationRepository";
import {
  MAX_CUSTOMER_PURCHASE_HISTORY_REQUEST_BYTES,
  validateCustomerPurchaseHistoryUpload,
} from "@server/import/customerPurchaseHistoryUpload";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function clientSafeFileError(error: unknown): string {
  if (!(error instanceof Error)) return "The customer purchase-history report could not be read.";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.slice(0, 300) || "The customer purchase-history report could not be read.";
}

export async function POST(request: Request) {
  try {
    const owner = await requireStockManager();
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_CUSTOMER_PURCHASE_HISTORY_REQUEST_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "The XLSX file must be 5 MB or smaller.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_FORM", "Upload the customer purchase-history XLSX file as form data.", 400);
    }
    const action = formData.get("action");
    const file = formData.get("file");
    if (action !== "preview" && action !== "import") {
      return errorResponse("INVALID_ACTION", "Choose preview or import.", 400);
    }
    if (!(file instanceof File)) {
      return errorResponse("FILE_REQUIRED", "Choose a customer purchase-history XLSX file.", 400);
    }
    const uploadError = validateCustomerPurchaseHistoryUpload(file);
    if (uploadError) return errorResponse("INVALID_FILE", uploadError, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (action === "preview") {
      return Response.json({ data: await previewCustomerPurchaseHistoryMigration(file.name, bytes) });
    }

    const confirmationToken = formData.get("confirmationToken");
    if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) {
      return errorResponse("CONFIRMATION_REQUIRED", "Preview and confirm this file before importing.", 400);
    }
    const result = await importCustomerPurchaseHistoryMigration(
      file.name,
      bytes,
      confirmationToken,
      owner,
    );
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse("PERMISSION_DENIED", "Only an owner can import customer purchase history.", 403);
    }
    if (error instanceof CustomerPurchaseHistoryConfirmationError) {
      return errorResponse("PREVIEW_EXPIRED", error.message, 409);
    }
    if (error instanceof Error && (
      error.message.startsWith("Row ")
      || error.message.includes("XLSX")
      || error.message.includes("worksheet")
    )) {
      return errorResponse("INVALID_CUSTOMER_PURCHASE_DATA", clientSafeFileError(error), 422);
    }
    console.error("Customer purchase-history migration failed", error);
    return errorResponse("IMPORT_FAILED", "The customer purchase-history import could not be completed.", 500);
  }
}
