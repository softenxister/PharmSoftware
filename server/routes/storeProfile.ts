import { parseStoreProfileUpdate } from "@/config/preferences/storeProfile";
import { isAuthenticationError, requireAuthenticatedUser, requireStoreOwner } from "@server/auth/pharmUser";
import { readStoreProfile, saveStoreProfile } from "@server/db/storeProfileRepository";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    return Response.json({ profile: await readStoreProfile() });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load the store profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let owner;
  try {
    owner = await requireStoreOwner();
  } catch {
    return Response.json({ error: "Store settings permission denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Store profile details are invalid." }, { status: 400 });
  }
  const profile = parseStoreProfileUpdate(body);
  if (!profile) return Response.json({ error: "Store profile details are invalid." }, { status: 400 });

  try {
    return Response.json({ profile: await saveStoreProfile(profile, owner.name) });
  } catch {
    return Response.json({ error: "Unable to save the store profile." }, { status: 500 });
  }
}
