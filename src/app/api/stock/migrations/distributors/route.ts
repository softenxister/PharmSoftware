import {
  isAuthenticationError,
  requireStockManager,
} from "@/server/auth/pharmUser";
import {
  DistributorMigrationConfirmationError,
  importDistributorDataMigration,
  previewDistributorDataMigration,
} from "@/server/db/distributorDataMigrationRepository";
import {
  MAX_DISTRIBUTOR_DATA_REQUEST_BYTES,
  validateDistributorDataUpload,
} from "@/server/import/distributorDataUpload";

type MigrationAction = "preview" | "import";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function safeFileError(error: unknown): string {
  if (!(error instanceof Error)) return "The distributor file could not be read.";
  return error.message.replace(/\s+/g, " ").trim().slice(0, 300) || "The distributor file could not be read.";
}

export async function POST(request: Request) {
  try {
    await requireStockManager();
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_DISTRIBUTOR_DATA_REQUEST_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "The distributor file must be 5 MB or smaller.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_FORM", "Upload the distributor file as form data.", 400);
    }
    const action = formData.get("action");
    const file = formData.get("file");
    if (action !== "preview" && action !== "import") {
      return errorResponse("INVALID_ACTION", "Choose preview or import.", 400);
    }
    if (!(file instanceof File)) {
      return errorResponse("FILE_REQUIRED", "Choose a distributor XLSX or CSV file.", 400);
    }
    const uploadError = validateDistributorDataUpload(file);
    if (uploadError) return errorResponse("INVALID_FILE", uploadError, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());

    if ((action as MigrationAction) === "preview") {
      return Response.json({ data: await previewDistributorDataMigration(file.name, bytes) });
    }

    const confirmationToken = formData.get("confirmationToken");
    if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) {
      return errorResponse("CONFIRMATION_REQUIRED", "Preview and confirm this file before importing.", 400);
    }
    const result = await importDistributorDataMigration(file.name, bytes, confirmationToken);
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse("PERMISSION_DENIED", "Only an owner can import distributor data.", 403);
    }
    if (error instanceof DistributorMigrationConfirmationError) {
      return errorResponse("PREVIEW_EXPIRED", error.message, 409);
    }
    if (error instanceof Error && /CSV|XLSX|ZIP|required columns|Distributor (code|name)/i.test(error.message)) {
      return errorResponse("INVALID_DISTRIBUTOR_DATA", safeFileError(error), 422);
    }
    console.error("Distributor data migration failed", error);
    return errorResponse("IMPORT_FAILED", "The distributor import could not be completed.", 500);
  }
}
