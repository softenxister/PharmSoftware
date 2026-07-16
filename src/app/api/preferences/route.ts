import { parseAppPreferencesPatch } from "@/app/settings/appPreferences";
import { getCurrentPharmUser, requireAuthenticatedUser } from "@/server/auth/pharmUser";
import { readAppPreferences, saveAppPreferences } from "@/server/db/appPreferencesRepository";

export async function GET() {
  const user = await getCurrentPharmUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    return Response.json({ preferences: await readAppPreferences(user.id) });
  } catch {
    return Response.json({ error: "Unable to load account preferences." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Account preferences are invalid." }, { status: 400 });
  }
  const patch = parseAppPreferencesPatch(body);
  if (!patch) return Response.json({ error: "Account preferences are invalid." }, { status: 400 });

  try {
    return Response.json({ preferences: await saveAppPreferences(user.id, patch) });
  } catch {
    return Response.json({ error: "Unable to save account preferences." }, { status: 500 });
  }
}
