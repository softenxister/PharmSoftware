import { isAuthenticationError, requireAuthenticatedUser } from "@/server/auth/pharmUser";
import { storeAllExternalStockPhotos } from "@/server/db/stockRepository";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    return Response.json({
      result: await storeAllExternalStockPhotos(user.id),
    });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json(
      { error: "Unable to store external stock photos." },
      { status: 500 },
    );
  }
}
