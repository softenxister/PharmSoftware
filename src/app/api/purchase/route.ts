import { NextResponse } from "next/server";
import {
  readPurchaseBill,
  readPurchaseBills,
  savePurchaseBill,
  type PurchaseBillInput,
} from "@/server/db/purchaseRepository";
import { isValidPurchaseBillInput } from "@/server/db/purchaseValidation";

export const dynamic = "force-dynamic";

const purchaseErrorResponse = (error: unknown) => {
  const message = error instanceof Error && /^(A purchase|Purchase)/.test(error.message)
    ? error.message
    : "Unable to save purchase bill.";
  return NextResponse.json({ error: message }, { status: 400 });
};

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (id) {
      const bill = await readPurchaseBill(id);
      if (!bill) return NextResponse.json({ error: "Purchase bill was not found." }, { status: 404 });
      return NextResponse.json({ bill });
    }
    const bills = await readPurchaseBills();
    return NextResponse.json({ bills });
  } catch {
    return NextResponse.json({ error: "Unable to load purchase bills." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidPurchaseBillInput(body)) {
      return NextResponse.json({ error: "Purchase bill data is invalid." }, { status: 400 });
    }
    const result = await savePurchaseBill(body as PurchaseBillInput);
    return NextResponse.json(result);
  } catch (error) {
    return purchaseErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!isValidPurchaseBillInput(body, { requireId: true })) {
      return NextResponse.json({ error: "Purchase bill data is invalid." }, { status: 400 });
    }
    const result = await savePurchaseBill(body as PurchaseBillInput);
    return NextResponse.json(result);
  } catch (error) {
    return purchaseErrorResponse(error);
  }
}
