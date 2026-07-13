import { NextResponse } from "next/server";
import { requireStockManager } from "@/server/auth/pharmUser";
import { applyStockAdjustment } from "@/server/db/purchaseCorrectionRepository";
import {
  isValidStockAdjustmentInput,
  type StockAdjustmentInput,
} from "@/server/db/purchaseCorrectionValidation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const manager = requireStockManager();
    const body = await request.json();
    if (!isValidStockAdjustmentInput(body)) {
      return NextResponse.json({ error: "Purchase stock adjustment is invalid." }, { status: 400 });
    }
    const adjustmentId = await applyStockAdjustment(body as StockAdjustmentInput, manager);
    return NextResponse.json({ adjustmentId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Purchase")
      ? error.message
      : "Purchase stock adjustment could not be saved.";
    return NextResponse.json(
      { error: message },
      { status: message === "Purchase permission denied." ? 403 : 400 },
    );
  }
}
