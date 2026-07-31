import { parseAccountProfileUpdate } from "@server/auth/accountValidation";
import { requireAuthenticatedUser, toPharmUser } from "@server/auth/pharmUser";
import { updateAccountProfile } from "@server/db/auth/authRepository";

export async function GET() {
  try {
    return Response.json({ user: await requireAuthenticatedUser() });
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
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
    return Response.json({ error: "Account details are invalid." }, { status: 400 });
  }
  const input = parseAccountProfileUpdate(body);
  if (!input) return Response.json({ error: "Account details are invalid." }, { status: 400 });

  try {
    const account = await updateAccountProfile(user.id, input);
    if (!account) return Response.json({ error: "Account was not found." }, { status: 404 });
    return Response.json({ user: toPharmUser(account) });
  } catch (error) {
    const message = String(error);
    const status = message.includes("unique") || message.includes("23505") ? 409 : 500;
    return Response.json({
      error: status === 409 ? "That username is already in use." : "Unable to update the account.",
    }, { status });
  }
}
