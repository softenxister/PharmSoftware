import { createHash } from "node:crypto";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";
import { createUnresolvedProductSvg } from "@server/product-images/placeholder";
import {
  readProductImageAsset,
  readStoredProductImage,
} from "@server/product-images/externalStorage";
import { routeParameter } from "@server/product-images/routeUtils";

function placeholderResponse(brandName: string, version: string) {
  const svg = createUnresolvedProductSvg(brandName);
  const etag = `"placeholder-${createHash("sha256").update(`${brandName}:${version}`).digest("hex").slice(0, 24)}"`;
  return new Response(svg, {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "content-type": "image/svg+xml; charset=utf-8",
      etag,
      "x-content-type-options": "nosniff",
    },
  });
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
    if (!product.imageAsset) return placeholderResponse(product.brandName, product.updatedAt.toISOString());
    try {
      const stored = await readStoredProductImage(product.imageAsset.storageKey);
      return new Response(stored.body, {
        headers: {
          "cache-control": "private, max-age=86400",
          "content-length": String(product.imageAsset.byteSize),
          "content-type": product.imageAsset.mimeType,
          etag: `"${product.imageAsset.sha256}"`,
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return placeholderResponse(product.brandName, product.imageAsset.updatedAt.toISOString());
    }
  } catch {
    return Response.json({ error: "Unable to load the product image." }, { status: 500 });
  }
}
