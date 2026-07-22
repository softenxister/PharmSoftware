import {
  isAuthenticationError,
  requireStockManager,
} from "@/server/auth/pharmUser";
import {
  importMemberDataMigration,
  MemberMigrationConfirmationError,
  previewMemberDataMigration,
} from "@/server/db/memberDataMigrationRepository";
import {
  decodeUtf8MemberDataUpload,
  MAX_MEMBER_DATA_REQUEST_BYTES,
  validateMemberDataUpload,
} from "@/server/import/memberDataUpload";

type MigrationAction = "preview" | "import";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function clientSafeCsvError(error: unknown): string {
  if (!(error instanceof Error)) return "The member CSV could not be read.";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.slice(0, 300) || "The member CSV could not be read.";
}

export async function POST(request: Request) {
  try {
    await requireStockManager();
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_MEMBER_DATA_REQUEST_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "The CSV file must be 5 MB or smaller.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_FORM", "Upload the member CSV as form data.", 400);
    }

    const action = formData.get("action");
    const file = formData.get("file");
    if (action !== "preview" && action !== "import") {
      return errorResponse("INVALID_ACTION", "Choose preview or import.", 400);
    }
    if (!(file instanceof File)) {
      return errorResponse("FILE_REQUIRED", "Choose a member CSV file.", 400);
    }
    const uploadError = validateMemberDataUpload(file);
    if (uploadError) return errorResponse("INVALID_FILE", uploadError, 400);

    const csvText = decodeUtf8MemberDataUpload(new Uint8Array(await file.arrayBuffer()));
    if (csvText.includes("\0")) {
      return errorResponse("INVALID_FILE", "The CSV file contains unsupported binary data.", 400);
    }

    if ((action as MigrationAction) === "preview") {
      return Response.json({ data: await previewMemberDataMigration(csvText) });
    }

    const confirmationToken = formData.get("confirmationToken");
    if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) {
      return errorResponse("CONFIRMATION_REQUIRED", "Preview and confirm this file before importing.", 400);
    }
    const result = await importMemberDataMigration(csvText, confirmationToken);
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse("PERMISSION_DENIED", "Only an owner can import member data.", 403);
    }
    if (error instanceof MemberMigrationConfirmationError) {
      return errorResponse("PREVIEW_EXPIRED", error.message, 409);
    }
    if (error instanceof Error && (
      error.message.startsWith("CSV ")
      || error.message.startsWith("Row ")
      || error.message.includes("UTF-8")
    )) {
      return errorResponse("INVALID_MEMBER_DATA", clientSafeCsvError(error), 422);
    }
    console.error("Member data migration failed", error);
    return errorResponse("IMPORT_FAILED", "The member import could not be completed.", 500);
  }
}
