import {
  isAuthenticationError,
  requireStockManager,
} from "@server/auth/pharmUser";
import {
  importLotExpiryMigration,
  LotExpiryMigrationConfirmationError,
  previewLotExpiryMigration,
} from "@server/db/migration/lotExpiryMigrationRepository";
import {
  MAX_LOT_EXPIRY_REQUEST_BYTES,
  validateLotExpiryUpload,
} from "@server/import/lotExpiryUpload";

type MigrationAction = "preview" | "import";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function clientSafeFileError(error: unknown): string {
  if (!(error instanceof Error)) return "The CW lot and expiry file could not be read.";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.slice(0, 300) || "The CW lot and expiry file could not be read.";
}

export async function POST(request: Request) {
  try {
    const owner = await requireStockManager();
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_LOT_EXPIRY_REQUEST_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "The XLSX file must be 5 MB or smaller.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_FORM", "Upload the CW XLSX file as form data.", 400);
    }
    const action = formData.get("action");
    const file = formData.get("file");
    if (action !== "preview" && action !== "import") {
      return errorResponse("INVALID_ACTION", "Choose preview or import.", 400);
    }
    if (!(file instanceof File)) {
      return errorResponse("FILE_REQUIRED", "Choose a CW lot and expiry XLSX file.", 400);
    }
    const uploadError = validateLotExpiryUpload(file);
    if (uploadError) return errorResponse("INVALID_FILE", uploadError, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());

    if ((action as MigrationAction) === "preview") {
      const preview = await previewLotExpiryMigration(file.name, bytes);
      return Response.json({ data: preview });
    }

    const confirmationToken = formData.get("confirmationToken");
    if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) {
      return errorResponse("CONFIRMATION_REQUIRED", "Preview and confirm this file before importing.", 400);
    }
    const result = await importLotExpiryMigration(
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
      return errorResponse("PERMISSION_DENIED", "Only an owner can import lot and expiry data.", 403);
    }
    if (error instanceof LotExpiryMigrationConfirmationError) {
      return errorResponse("PREVIEW_EXPIRED", error.message, 409);
    }
    if (error instanceof Error && (
      error.message.startsWith("Row ")
      || error.message.includes("XLSX")
    )) {
      return errorResponse("INVALID_CW_DATA", clientSafeFileError(error), 422);
    }
    console.error("CW lot and expiry migration failed", error);
    return errorResponse("IMPORT_FAILED", "The lot and expiry import could not be completed.", 500);
  }
}
