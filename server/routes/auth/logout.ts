import { clearSessionCookie } from "@server/auth/sessionCookie";
import { getRequestCookie } from "@server/auth/requestContext";
import { AUTH_SESSION_COOKIE, hashSessionToken } from "@server/auth/sessionToken";
import { deleteAuthSession } from "@server/db/authRepository";

export async function POST() {
  const token = getRequestCookie(AUTH_SESSION_COOKIE);
  if (token) {
    try {
      await deleteAuthSession(hashSessionToken(token));
    } catch {
      // Clearing the browser session remains safe even if the database is unavailable.
    }
  }
  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
