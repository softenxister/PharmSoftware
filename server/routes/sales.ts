import { readSales, saveSale, type SaleInput } from "@server/db/saleRepository";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    return Response.json({ sales: await readSales() });
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
