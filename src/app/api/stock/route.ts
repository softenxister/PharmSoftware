import { NextResponse } from "next/server";
import { parseStockDeleteRequest } from "@/server/db/stockDeleteRequest";
import { deleteStockItem, readStockProducts, saveStockItem, saveStockItems } from "@/server/db/stockRepository";
import type { StockItemInput } from "@/server/db/types";

export const dynamic = "force-dynamic";

function isStockItemInput(value: unknown): value is StockItemInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const stringFields = [
    "photoUrl", "barcode", "itemName", "lotNo", "expiryDate", "location",
    "manufacturer", "sellPrice", "itemCategory", "weightage", "unit", "brandName",
  ];
  return stringFields.every((field) => typeof item[field] === "string")
    && (item.subUnit === undefined || typeof item.subUnit === "string")
    && Array.isArray(item.packagingRows);
}

export async function GET() {
  try {
    const products = await readStockProducts();
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Unable to load stock." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputs = Array.isArray(body?.items) ? body.items : [body];
    if (inputs.length === 0 || !inputs.every(isStockItemInput)) {
      return NextResponse.json({ error: "Stock item data is invalid." }, { status: 400 });
    }

    const products = Array.isArray(body?.items)
      ? await saveStockItems(inputs)
      : await saveStockItem(inputs[0]);
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Unable to save stock item." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const input = parseStockDeleteRequest(await request.json());
    if (!input) {
      return NextResponse.json({ error: "Stock item identifier is invalid." }, { status: 400 });
    }

    const products = await deleteStockItem(input.productId);
    if (!products) {
      return NextResponse.json({ error: "Stock item was not found." }, { status: 404 });
    }
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Unable to delete stock item." }, { status: 400 });
  }
}
