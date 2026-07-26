import { parseLoginInput } from "@server/auth/accountValidation";
import { establishSession } from "@server/auth/establishSession";
import { getLoginThrottleStatus } from "@server/auth/loginThrottle";
import { hashPassword, verifyPassword } from "@server/auth/password";
import { setSessionCookie } from "@server/auth/sessionCookie";
import { toPharmUser } from "@server/auth/pharmUser";
import {
  clearLoginThrottle,
  markSuccessfulLogin,
  readAccountByUsername,
  readLoginThrottle,
  recordFailedLogin,
  type PrivatePharmAccount,
} from "@server/db/authRepository";

const invalidResponse = () => Response.json(
  { error: "Username or password is incorrect." },
  { status: 401 },
);

export const isAccountLoginEnabled = (
  account: Pick<PrivatePharmAccount, "role" | "isActive" | "setupCompletedAt">,
): boolean => account.isActive && (account.role !== "owner" || account.setupCompletedAt !== null);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a valid username and password." }, { status: 400 });
  }
  const input = parseLoginInput(body);
  if (!input) return Response.json({ error: "Enter a valid username and password." }, { status: 400 });

  try {
    const throttleStatus = getLoginThrottleStatus(await readLoginThrottle(input.username));
    if (throttleStatus.blocked) {
      return Response.json(
        { error: `Too many attempts. Try again in ${Math.ceil(throttleStatus.retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(throttleStatus.retryAfterSeconds) } },
      );
    }

    const account = await readAccountByUsername(input.username);
    let passwordValid = false;
    if (account?.passwordHash) {
      passwordValid = await verifyPassword(input.password, account.passwordHash);
    } else {
      // Preserve similar work for unknown usernames without keeping a reusable dummy credential.
      await hashPassword(input.password);
    }

    if (!account || !passwordValid || !isAccountLoginEnabled(account)) {
      await recordFailedLogin(input.username);
      return invalidResponse();
    }

    await clearLoginThrottle(input.username);
    await markSuccessfulLogin(account.id);
    const token = await establishSession(account.id);
    const response = Response.json({ user: toPharmUser(account) });
    setSessionCookie(response, token);
    return response;
  } catch {
    return Response.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
