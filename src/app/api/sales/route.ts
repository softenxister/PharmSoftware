import { NextResponse } from "next/server";
import { readSales, saveSale, type SaleInput } from "@/server/db/saleRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ sales: await readSales() });
  } catch {
    return NextResponse.json({ error: "Unable to load sales." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SaleInput;
    if (body?.status !== "paid" && body?.status !== "pending") {
      return NextResponse.json({ error: "Sale status is invalid." }, { status: 400 });
    }

    return NextResponse.json(await saveSale(body));
  } catch (error) {
    const message = error instanceof Error && [
      "A sale", "Sale ", "One or more", "Customer payment", "Payment and",
      "Batch ", "Insufficient stock", "A paid sale",
    ].some((prefix) => error.message.startsWith(prefix))
      ? error.message
      : "Unable to save sale.";
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
