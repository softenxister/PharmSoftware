import { normalizeReceiptPaperSize } from "@/lib/receipt";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";
import {
  readPaidReceipt,
  ReceiptNotFoundError,
  ReceiptNotPrintableError,
} from "@server/db/sale/receiptRepository";
import { generateReceiptPdf } from "@server/receipts/receiptPdf";

function safeFilename(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 100) || "receipt";
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const saleId = url.searchParams.get("saleId")?.trim() ?? "";
    if (!saleId || saleId.length > 200) {
      return Response.json({ error: "Sale ID is invalid." }, { status: 400 });
    }
    const receipt = await readPaidReceipt(saleId);
    const bytes = await generateReceiptPdf(receipt.snapshot, normalizeReceiptPaperSize(url.searchParams.get("paper")));
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(bytes as BodyInit, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${disposition}; filename="receipt-${safeFilename(receipt.snapshot.billNo)}.pdf"`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof ReceiptNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof ReceiptNotPrintableError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Unable to generate receipt PDF." }, { status: 500 });
  }
}
