import {
  createAuthSession,
} from "@server/db/authRepository";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  hashSessionToken,
} from "./sessionToken";

export async function establishSession(accountId: string): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);
  await createAuthSession(hashSessionToken(token), accountId, expiresAt);
  return token;
}
