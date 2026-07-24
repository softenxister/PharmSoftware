import { requireStoreOwner } from "@/server/auth/pharmUser";
import {
  ProductImageCandidateNotFoundError,
  ProductImageCandidateStateError,
  rejectProductImageCandidate,
} from "@/server/product-images/repository";
import { parseProductImageDecisionInput } from "@/server/product-images/reviewContract";
import { routeParameter } from "@/server/product-images/routeUtils";

export async function POST(request: Request) {
  let owner;
  try {
    owner = await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image review permission denied." }, { status: 403 });
  }
  const candidateId = routeParameter(request, "/api/product-image-review/", "/reject");
  if (!candidateId) return Response.json({ error: "Product image candidate is invalid." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A rejection reason is required." }, { status: 400 });
  }
  const input = parseProductImageDecisionInput(body);
  if (!input) return Response.json({ error: "A rejection reason of 500 characters or fewer is required." }, { status: 400 });

  try {
    await rejectProductImageCandidate({ candidateId, reviewerId: owner.id, ...input });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductImageCandidateNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProductImageCandidateStateError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Unable to reject the product image." }, { status: 500 });
  }
}
