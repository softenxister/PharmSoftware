import { requireStoreOwner } from "@server/auth/pharmUser";
import { storeAllExternalStockPhotos } from "@server/product-images/stockPhotoStorage";

export async function POST() {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image storage permission denied." }, { status: 403 });
  }
  try {
    return Response.json({ result: await storeAllExternalStockPhotos() });
  } catch {
    return Response.json(
      { error: "Unable to store external stock photos." },
      { status: 500 },
    );
  }
}
