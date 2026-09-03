import {
  deletePendingSale,
  parsePendingSaleDeleteRequest,
  PendingSaleConflictError,
  readSales,
  saveSale,
  type SaleInput,
} from "@server/db/sale/saleRepository";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const saleId = new URL(request.url).searchParams.get("saleId")?.trim();
    return Response.json({ sales: await readSales(saleId || undefined) });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load sales." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json() as SaleInput;
    if (body?.status !== "paid" && body?.status !== "pending") {
      return Response.json({ error: "Sale status is invalid." }, { status: 400 });
    }

    return Response.json(await saveSale(body));
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof PendingSaleConflictError) {
      return Response.json(
        { error: error.message, code: "PENDING_SALE_CONFLICT" },
        { status: 409 },
      );
    }
    const message = error instanceof Error && [
      "A sale", "Sale ", "One or more", "Customer payment", "Payment and",
      "Batch ", "Insufficient stock", "A paid sale", "Store Profile", "Receipt ",
    ].some((prefix) => error.message.startsWith(prefix))
      ? error.message
      : "Unable to save sale.";
    return Response.json(
      { error: message },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedUser();
    const saleId = parsePendingSaleDeleteRequest(await request.json());
    if (!saleId) {
      return Response.json({ error: "Pending sale identifier is invalid." }, { status: 400 });
    }
    const deletedSaleId = await deletePendingSale(saleId);
    if (!deletedSaleId) {
      return Response.json({ error: "Pending sale was not found." }, { status: 404 });
    }
    return Response.json({ deletedSaleId });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to delete pending sale." }, { status: 400 });
  }
}
