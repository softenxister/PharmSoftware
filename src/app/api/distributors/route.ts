import { NextResponse } from "next/server";
import { readDistributorNames } from "@/server/db/purchaseRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ distributors: await readDistributorNames() });
  } catch {
    return NextResponse.json({ error: "Unable to load distributors." }, { status: 500 });
  }
}
