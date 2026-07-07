import { NextResponse } from "next/server";
import { readStockProductsFromFile, saveStockItemsToFile, saveStockItemToFile } from "@/server/db/stockFileRepository";
import type { StockItemInput } from "@/server/db/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await readStockProductsFromFile();
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const body = await request.json();
  const products = Array.isArray(body?.items)
    ? await saveStockItemsToFile(body.items as StockItemInput[])
    : await saveStockItemToFile(body as StockItemInput);

  return NextResponse.json({ products });
}
