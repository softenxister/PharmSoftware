import { isAuthenticationError, requireAuthenticatedUser, requireStockManager } from "@/server/auth/pharmUser";
import {
  createPurchaseCorrectionRequest,
  readPurchaseCorrectionRequests,
  rejectPurchaseCorrectionRequest,
} from "@/server/db/purchaseCorrectionRepository";
import {
  isValidCorrectionRequestInput,
  type CorrectionRequestInput,
} from "@/server/db/purchaseCorrectionValidation";

const errorResponse = (error: unknown) => {
  if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
  const message = error instanceof Error && error.message.startsWith("Purchase")
    ? error.message
    : "Purchase correction request could not be processed.";
  const status = message === "Purchase permission denied." ? 403 : 400;
  return Response.json({ error: message }, { status });
};

export async function GET(request: Request) {
  try {
    const purchaseBillId = new URL(request.url).searchParams.get("purchaseBillId")?.trim();
    if (!purchaseBillId) await requireStockManager();
    const requests = await readPurchaseCorrectionRequests(purchaseBillId);
    return Response.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidCorrectionRequestInput(body)) {
      return Response.json({ error: "Purchase correction request is invalid." }, { status: 400 });
    }
    const correctionRequest = await createPurchaseCorrectionRequest(
      body as CorrectionRequestInput,
      await requireAuthenticatedUser(),
    );
    return Response.json({ correctionRequest }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const reviewer = await requireStockManager();
    const body = await request.json() as Record<string, unknown>;
    if (
      body.action !== "reject"
      || typeof body.requestId !== "string"
      || !body.requestId.trim()
      || (body.reviewNote !== undefined && (typeof body.reviewNote !== "string" || body.reviewNote.length > 500))
    ) {
      return Response.json({ error: "Purchase correction review is invalid." }, { status: 400 });
    }
    await rejectPurchaseCorrectionRequest(body.requestId, String(body.reviewNote ?? ""), reviewer);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
