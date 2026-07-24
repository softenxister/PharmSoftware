import { requireStoreOwner } from "@/server/auth/pharmUser";
import {
  ProductImageCandidateNotFoundError,
  ProductImageCandidateStateError,
  readCandidatePreview,
} from "@/server/product-images/repository";
import { routeParameter } from "@/server/product-images/routeUtils";

export async function GET(request: Request) {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image review permission denied." }, { status: 403 });
  }
  const candidateId = routeParameter(request, "/api/product-image-candidates/", "/preview");
  if (!candidateId) return Response.json({ error: "Product image candidate is invalid." }, { status: 400 });

  try {
    const image = await readCandidatePreview(candidateId);
    const body = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(body).set(image.bytes);
    return new Response(body, {
      headers: {
        "cache-control": "private, no-store",
        "content-length": String(image.bytes.byteLength),
        "content-type": image.metadata.mimeType,
        etag: `"${image.sha256}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ProductImageCandidateNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProductImageCandidateStateError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Unable to load the candidate image." }, { status: 502 });
  }
}
