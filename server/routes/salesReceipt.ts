import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";
import {
  readPaidReceipt,
  ReceiptNotFoundError,
  ReceiptNotPrintableError,
} from "@server/db/sale/receiptRepository";

function receiptId(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("saleId")?.trim() ?? "";
  return value && value.length <= 200 ? value : null;
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const saleId = receiptId(request);
    if (!saleId) return Response.json({ error: "Sale ID is invalid." }, { status: 400 });
    const receipt = await readPaidReceipt(saleId);
    return Response.json({
      receipt: {
        saleId: receipt.snapshot.saleId,
        billNo: receipt.snapshot.billNo,
        isLegacy: receipt.isLegacy,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof ReceiptNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof ReceiptNotPrintableError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Unable to load receipt." }, { status: 500 });
  }
}
