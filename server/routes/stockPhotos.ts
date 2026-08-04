import {
  isAuthenticationError,
  requireAuthenticatedUser,
  requireStoreOwner,
} from "@server/auth/pharmUser";
import { storeAllExternalStockPhotos } from "@server/product-images/stockPhotoStorage";
import {
  storeUploadedProductImage,
  UploadedProductImageValidationError,
} from "@server/product-images/externalStorage";
import { MAX_PRODUCT_IMAGE_BYTES } from "@server/product-images/imageMetadata";
import { routeParameter } from "@server/product-images/routeUtils";

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

export async function PUT(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return Response.json({
      error: isAuthenticationError(error) ? error.message : "Authentication required.",
    }, { status: 401 });
  }

  const productId = routeParameter(request, "/api/stock/photos/");
  if (!productId) return Response.json({ error: "Product is invalid." }, { status: 400 });
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_PRODUCT_IMAGE_BYTES) {
    return Response.json({ error: "Product images must not exceed 8 MiB." }, { status: 413 });
  }

  try {
    const result = await storeUploadedProductImage(
      productId,
      new Uint8Array(await request.arrayBuffer()),
      request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "",
    );
    if (!result) return Response.json({ error: "Stock item was not found." }, { status: 404 });
    return Response.json({ result });
  } catch (error) {
    if (error instanceof UploadedProductImageValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json({ error: "Unable to store this product photo." }, { status: 500 });
  }
}
