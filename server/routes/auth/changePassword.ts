import { parsePasswordChangeInput } from "@server/auth/accountValidation";
import { getRequestCookie } from "@server/auth/requestContext";
import { getCurrentPharmAccount, toPharmUser } from "@server/auth/pharmUser";
import { hashPassword, verifyPassword } from "@server/auth/password";
import { AUTH_SESSION_COOKIE, hashSessionToken } from "@server/auth/sessionToken";
import { deleteAccountSessions, updateAccountPassword } from "@server/db/auth/authRepository";

export async function POST(request: Request) {
  const account = await getCurrentPharmAccount();
  if (!account?.passwordHash) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Password details are invalid." }, { status: 400 });
  }
  const input = parsePasswordChangeInput(body, !account.mustChangePassword);
  if (!input) return Response.json({ error: "Password details are invalid." }, { status: 400 });

  if (!account.mustChangePassword && !await verifyPassword(input.currentPassword, account.passwordHash)) {
    return Response.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  if (await verifyPassword(input.newPassword, account.passwordHash)) {
    return Response.json({ error: "Choose a password you have not already used here." }, { status: 400 });
  }

  try {
    await updateAccountPassword(account.id, await hashPassword(input.newPassword));
    const currentToken = getRequestCookie(AUTH_SESSION_COOKIE);
    await deleteAccountSessions(account.id, currentToken ? hashSessionToken(currentToken) : undefined);
    return Response.json({ user: toPharmUser({ ...account, mustChangePassword: false }) });
  } catch {
    return Response.json({ error: "Unable to change the password." }, { status: 500 });
  }
}
