import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";
import { updateStockProductPhotoUrl } from "@server/db/stockRepository";
import { parseStockPhotoUrlUpdate } from "@server/db/stockPhotoUrlUpdate";

export async function PATCH(request: Request) {
  try {
    await requireAuthenticatedUser();
    const input = parseStockPhotoUrlUpdate(await request.json());
    if (!input) {
      return Response.json({ error: "A public HTTPS photo URL is required." }, { status: 422 });
    }
    const result = await updateStockProductPhotoUrl(input.productId, input.photoUrl);
    if (!result) {
      return Response.json({ error: "Stock item was not found." }, { status: 404 });
    }
    return Response.json({ result });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Unable to save this photo URL." }, { status: 500 });
  }
}
