import { parseStockDeleteRequest } from "@server/db/stockDeleteRequest";
import {
  readStockProducts,
} from "@server/db/stock/stockCatalogRepository";
import {
  deleteStockItem,
  saveStockItem,
  saveStockItems,
  updateStockItemDetail,
} from "@server/db/stock/stockItemRepository";
import { parseStockItemDetailPatch } from "@server/db/stockItemDetail";
import type { StockItemInput } from "@server/db/types";
import { parseStockReadQuery } from "@server/db/stockReadQuery";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";

function isStockItemInput(value: unknown): value is StockItemInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const stringFields = [
    "photoUrl", "barcode", "itemName", "lotNo", "expiryDate", "location",
    "manufacturer", "sellPrice", "itemCategory", "weightage", "unit", "brandName",
  ];
  return stringFields.every((field) => typeof item[field] === "string")
    && (item.productId === undefined || typeof item.productId === "string")
    && (item.barcodes === undefined || (Array.isArray(item.barcodes) && item.barcodes.every((barcode) => typeof barcode === "string")))
    && (item.subUnit === undefined || typeof item.subUnit === "string")
    && Array.isArray(item.packagingRows);
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    return Response.json(await readStockProducts(parseStockReadQuery(request.url)));
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load stock." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const inputs = Array.isArray(body?.items) ? body.items : [body];
    if (inputs.length === 0 || !inputs.every(isStockItemInput)) {
      return Response.json({ error: "Stock item data is invalid." }, { status: 400 });
    }

    if (Array.isArray(body?.items)) {
      return Response.json({ savedCount: await saveStockItems(inputs) });
    }
    return Response.json({ product: await saveStockItem(inputs[0]) });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to save stock item." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = parseStockItemDetailPatch(await request.json());
    if (!input) return Response.json({ error: "Stock item detail data is invalid." }, { status: 400 });
    const product = await updateStockItemDetail(input, user);
    if (!product) return Response.json({ error: "Stock item was not found." }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof Error && error.message === "Stock discount permission denied.") {
      return Response.json({ error: "Only an owner can change item discount settings." }, { status: 403 });
    }
    return Response.json({ error: "Unable to save stock item details." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedUser();
    const input = parseStockDeleteRequest(await request.json());
    if (!input) {
      return Response.json({ error: "Stock item identifier is invalid." }, { status: 400 });
    }

    const deletedProductId = await deleteStockItem(input.productId);
    if (!deletedProductId) {
      return Response.json({ error: "Stock item was not found." }, { status: 404 });
    }
    return Response.json({ deletedProductId });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to delete stock item." }, { status: 400 });
  }
}
