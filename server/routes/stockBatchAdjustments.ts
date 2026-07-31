import { isValidDirectStockAdjustmentInput } from "@/lib/directStockAdjustment";
import {
  isAuthenticationError,
  requireStockManager,
} from "@server/auth/pharmUser";
import { applyDirectStockAdjustment } from "@server/db/stock/directStockAdjustmentRepository";

const CLIENT_SAFE_ERRORS = new Set([
  "Stock item was not found.",
  "Stock adjustment has no quantity changes.",
]);

function adjustmentError(error: unknown) {
  if (!(error instanceof Error)) return "Unable to adjust stock.";
  if (CLIENT_SAFE_ERRORS.has(error.message) || /^Batch .+ was not found for this stock item\.$/.test(error.message)) {
    return error.message;
  }
  return "Unable to adjust stock.";
}

export async function POST(request: Request) {
  try {
    const owner = await requireStockManager();
    const input: unknown = await request.json();
    if (!isValidDirectStockAdjustmentInput(input)) {
      return Response.json({ error: "Stock adjustment data is invalid." }, { status: 400 });
    }

    const adjustment = await applyDirectStockAdjustment(input, owner);
    return Response.json(adjustment, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return Response.json({ error: "Only an admin can adjust stock." }, { status: 403 });
    }
    return Response.json({ error: adjustmentError(error) }, { status: 400 });
  }
}
