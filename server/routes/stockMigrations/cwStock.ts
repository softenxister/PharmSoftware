import {
  isAuthenticationError,
  requireStockManager,
} from "@server/auth/pharmUser";
import {
  CwMigrationConfirmationError,
  importCwStockMigration,
  previewCwStockMigration,
} from "@server/db/migration/cwStockMigrationRepository";
import {
  CwStockDetailUpdateConfirmationError,
  importCwStockDetailUpdate,
  previewCwStockDetailUpdate,
} from "@server/db/migration/cwStockDetailUpdateRepository";
import {
  decodeCwStockUpload,
  MAX_CW_STOCK_REQUEST_BYTES,
  validateCwStockUpload,
} from "@server/import/cwStockUpload";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function clientSafeCsvError(error: unknown): string {
  if (!(error instanceof Error)) return "The CW stock file could not be read.";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.slice(0, 300) || "The CW stock file could not be read.";
}

export async function POST(request: Request) {
  try {
    const owner = await requireStockManager();
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_CW_STOCK_REQUEST_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "The CSV file must be 5 MB or smaller.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_FORM", "Upload the CW stock file as form data.", 400);
    }

    const action = formData.get("action");
    const mode = formData.get("mode");
    const file = formData.get("file");
    if (action !== "preview" && action !== "import") {
      return errorResponse("INVALID_ACTION", "Choose preview or import.", 400);
    }
    if (!(file instanceof File)) {
      return errorResponse("FILE_REQUIRED", "Choose a CW stock CSV file.", 400);
    }
    if (mode !== "full" && mode !== "generic-cost-update") {
      return errorResponse("INVALID_MODE", "Choose full import or generic-name, legal-category and cost update.", 400);
    }
    const uploadError = validateCwStockUpload(file);
    if (uploadError) return errorResponse("INVALID_FILE", uploadError, 400);

    const csvText = decodeCwStockUpload(new Uint8Array(await file.arrayBuffer()));
    if (csvText.includes("\0")) {
      return errorResponse("INVALID_FILE", "The CSV file contains unsupported binary data.", 400);
    }

    if (action === "preview") {
      const preview = mode === "full"
        ? await previewCwStockMigration(csvText)
        : await previewCwStockDetailUpdate(csvText);
      return Response.json({ data: preview });
    }

    const confirmationToken = formData.get("confirmationToken");
    if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) {
      return errorResponse("CONFIRMATION_REQUIRED", "Preview and confirm this file before importing.", 400);
    }
    const result = mode === "full"
      ? await importCwStockMigration(csvText, confirmationToken, file.name, owner)
      : await importCwStockDetailUpdate(csvText, confirmationToken, file.name, owner);
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse("PERMISSION_DENIED", "Only an owner can import stock data.", 403);
    }
    if (error instanceof CwMigrationConfirmationError
      || error instanceof CwStockDetailUpdateConfirmationError) {
      return errorResponse("PREVIEW_EXPIRED", error.message, 409);
    }
    if (error instanceof Error && (
      error.message.startsWith("CSV ")
      || error.message.startsWith("Row ")
    )) {
      return errorResponse("INVALID_CW_DATA", clientSafeCsvError(error), 422);
    }
    console.error("CW stock migration failed", error);
    return errorResponse("IMPORT_FAILED", "The CW stock import could not be completed.", 500);
  }
}
