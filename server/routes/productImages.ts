import { createHash } from "node:crypto";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";
import { createUnresolvedProductSvg } from "@server/product-images/placeholder";
import {
  isProductImageNotModified,
  productImageResponseHeaders,
} from "@server/product-images/httpCache";
import {
  readProductImageAsset,
  readStoredProductImage,
} from "@server/product-images/externalStorage";
import { routeParameter } from "@server/product-images/routeUtils";

function placeholderResponse(request: Request, brandName: string, version: string) {
  const svg = createUnresolvedProductSvg(brandName);
  const opaqueTag = `placeholder-${createHash("sha256").update(`${brandName}:${version}`).digest("hex").slice(0, 24)}`;
  const headers = new Headers({
    "cache-control": "private, max-age=3600",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    "content-type": "image/svg+xml; charset=utf-8",
    etag: `"${opaqueTag}"`,
    "x-content-type-options": "nosniff",
  });
  return isProductImageNotModified(request.headers.get("if-none-match"), opaqueTag)
    ? new Response(null, { status: 304, headers })
    : new Response(svg, { headers });
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return Response.json({
      error: isAuthenticationError(error) ? error.message : "Authentication required.",
    }, { status: 401 });
  }
  const productId = routeParameter(request, "/api/product-images/");
  if (!productId) return Response.json({ error: "Product is invalid." }, { status: 400 });

  try {
    const product = await readProductImageAsset(productId);
    if (!product) return Response.json({ error: "Product was not found." }, { status: 404 });
    if (!product.imageAsset) {
      return placeholderResponse(request, product.brandName, product.updatedAt.toISOString());
    }
    try {
      const headers = productImageResponseHeaders(
        product.imageAsset,
        new URL(request.url).searchParams.get("v"),
      );
      if (isProductImageNotModified(
        request.headers.get("if-none-match"),
        product.imageAsset.sha256,
      )) {
        return new Response(null, { status: 304, headers });
      }
      const stored = await readStoredProductImage(product.imageAsset.storageKey);
      return new Response(stored.body, { headers });
    } catch {
      return placeholderResponse(
        request,
        product.brandName,
        product.imageAsset.updatedAt.toISOString(),
      );
    }
  } catch {
    return Response.json({ error: "Unable to load the product image." }, { status: 500 });
  }
}
