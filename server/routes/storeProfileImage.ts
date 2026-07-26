import { MAX_STORE_PROFILE_IMAGE_BYTES, validateStoreProfileImage } from "@/config/preferences/storeProfile";
import { isAuthenticationError, requireAuthenticatedUser, requireStoreOwner } from "@server/auth/pharmUser";
import { readStoreProfileImage, saveStoreProfileImage } from "@server/db/storeProfileRepository";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const image = await readStoreProfileImage();
    if (!image) return Response.json({ error: "Store image was not found." }, { status: 404 });
    const body = new ArrayBuffer(image.imageData.byteLength);
    new Uint8Array(body).set(image.imageData);
    return new Response(body, {
      headers: {
        "cache-control": "private, max-age=31536000, immutable",
        "content-length": String(image.imageData.byteLength),
        "content-type": image.imageMimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load the store image." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let owner;
  try {
    owner = await requireStoreOwner();
  } catch {
    return Response.json({ error: "Store settings permission denied." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_STORE_PROFILE_IMAGE_BYTES) {
    return Response.json({ error: "Image must be 1 MB or smaller." }, { status: 413 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const bytes = new Uint8Array(await request.arrayBuffer());
  const validationError = validateStoreProfileImage(bytes, contentType);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  try {
    return Response.json({ profile: await saveStoreProfileImage(bytes, contentType, owner.name) });
  } catch {
    return Response.json({ error: "Unable to save the store image." }, { status: 500 });
  }
}
