import { requireStoreOwner } from "@/server/auth/pharmUser";
import {
  approveProductImageCandidate,
  ProductImageCandidateNotFoundError,
  ProductImageCandidateStateError,
} from "@/server/product-images/repository";
import { routeParameter } from "@/server/product-images/routeUtils";

export async function POST(request: Request) {
  let owner;
  try {
    owner = await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image review permission denied." }, { status: 403 });
  }
  const candidateId = routeParameter(request, "/api/product-image-review/", "/approve");
  if (!candidateId) return Response.json({ error: "Product image candidate is invalid." }, { status: 400 });

  try {
    await approveProductImageCandidate(candidateId, owner.id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductImageCandidateNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProductImageCandidateStateError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("not configured")) {
      return Response.json({
        error: "Private product-image storage is not configured. Add the server credentials before approval.",
      }, { status: 503 });
    }
    return Response.json({ error: "Unable to approve the product image." }, { status: 500 });
  }
}
