import { NextResponse } from "next/server";
import {
  readPurchaseBillsFromFile,
  savePurchaseBillToFile,
  type PurchaseBillInput,
} from "@/server/db/purchaseFileRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const bills = await readPurchaseBillsFromFile();
  return NextResponse.json({ bills });
}

export async function POST(request: Request) {
  const body = await request.json() as PurchaseBillInput;
  const bills = await savePurchaseBillToFile(body);
  return NextResponse.json({ bills });
}
