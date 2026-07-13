import { NextResponse } from "next/server";
import { getCurrentPharmUser } from "@/server/auth/pharmUser";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ user: getCurrentPharmUser() });
}
