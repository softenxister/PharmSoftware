import { isAuthenticationError, requireStockManager } from "@server/auth/pharmUser";
import { applyStockAdjustment } from "@server/db/purchaseCorrectionRepository";
import {
  isValidStockAdjustmentInput,
  type StockAdjustmentInput,
} from "@server/db/purchaseCorrectionValidation";

export async function POST(request: Request) {
  try {
    const manager = await requireStockManager();
    const body = await request.json();
    if (!isValidStockAdjustmentInput(body)) {
      return Response.json({ error: "Purchase stock adjustment is invalid." }, { status: 400 });
    }
    const adjustmentId = await applyStockAdjustment(body as StockAdjustmentInput, manager);
    return Response.json({ adjustmentId }, { status: 201 });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error && error.message.startsWith("Purchase")
      ? error.message
      : "Purchase stock adjustment could not be saved.";
    return Response.json(
      { error: message },
      { status: message === "Purchase permission denied." ? 403 : 400 },
    );
  }
}
