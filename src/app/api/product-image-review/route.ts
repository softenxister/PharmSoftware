import { requireStoreOwner } from "@/server/auth/pharmUser";
import { readProductImageReviewQueue } from "@/server/product-images/repository";
import { parseProductImageReviewQuery } from "@/server/product-images/reviewContract";

export async function GET(request: Request) {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image review permission denied." }, { status: 403 });
  }
  try {
    const data = await readProductImageReviewQueue(parseProductImageReviewQuery(new URL(request.url)));
    return Response.json({ data });
  } catch {
    return Response.json({ error: "Unable to load the product image review queue." }, { status: 500 });
  }
}
