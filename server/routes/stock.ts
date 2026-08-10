import { parseStockDeleteRequest } from "@server/db/stock/stockDeleteRequest";
import {
  readStockProducts,
} from "@server/db/stock/stockCatalogRepository";
import {
  deleteStockItem,
  updateStockItemDetail,
} from "@server/db/stock/stockItemRepository";
import { parseStockItemDetailPatch } from "@server/db/stock/stockItemDetail";
import {
  parseProductWriteRequest,
  persistProductWriteRequest,
} from "@server/db/stock/productWrite";
import { parseStockReadQuery } from "@server/db/stock/stockReadQuery";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";

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
    const input = parseProductWriteRequest(await request.json());
    if (!input) {
      return Response.json({ error: "Stock item data is invalid." }, { status: 400 });
    }

    const result = await persistProductWriteRequest(input);
    return result.mode === "bulk"
      ? Response.json({ savedCount: result.savedCount })
      : Response.json({ product: result.product });
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
