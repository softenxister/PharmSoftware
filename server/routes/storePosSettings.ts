import { parseStorePosSettingsUpdate } from "@/config/preferences/storePosSettings";
import { isAuthenticationError, requireAuthenticatedUser, requireStoreOwner } from "@server/auth/pharmUser";
import {
  readStorePosSettings,
  saveStorePosSettings,
} from "@server/db/settings/storePosSettingsRepository";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    return Response.json({ settings: await readStorePosSettings() });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load store POS settings." }, { status: 500 });
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
    return Response.json({ error: "Store POS settings are invalid." }, { status: 400 });
  }

  const settings = parseStorePosSettingsUpdate(body);
  if (!settings) {
    return Response.json({ error: "Store POS settings are invalid." }, { status: 400 });
  }

  try {
    return Response.json({ settings: await saveStorePosSettings(settings, owner.name) });
  } catch {
    return Response.json({ error: "Unable to save store POS settings." }, { status: 500 });
  }
}
