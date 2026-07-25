import { isAuthenticationError, requireAuthenticatedUser } from "@/server/auth/pharmUser";
import {
  StockProductNotFoundError,
  storeStockProductPhoto,
} from "@/server/db/stockRepository";
import { parseStockPhotoImportInput } from "@/server/db/stockPhotoImport";
import { ManualProductImageImportError } from "@/server/product-images/manualImport";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = parseStockPhotoImportInput(await request.json());
    if (!input) {
      return Response.json({ error: "A public HTTPS photo URL is required." }, { status: 422 });
    }
    return Response.json({
      product: await storeStockProductPhoto(input.productId, input.photoUrl, user.id),
    });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof StockProductNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ManualProductImageImportError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json({ error: "Unable to store this photo." }, { status: 500 });
  }
}
