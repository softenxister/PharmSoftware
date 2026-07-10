import { NextResponse } from "next/server";
import {
  readPurchaseBills,
  savePurchaseBill,
  type PurchaseBillInput,
} from "@/server/db/purchaseRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bills = await readPurchaseBills();
    return NextResponse.json({ bills });
  } catch {
    return NextResponse.json({ error: "Unable to load purchase bills." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PurchaseBillInput;
    if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "Purchase bill data is invalid." }, { status: 400 });
    }
    const bills = await savePurchaseBill(body);
    return NextResponse.json({ bills });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Purchase")
      ? error.message
      : "Unable to save purchase bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
