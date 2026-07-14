import { parseOwnerSetupInput } from "@/server/auth/accountValidation";
import { establishSession } from "@/server/auth/establishSession";
import { hashPassword } from "@/server/auth/password";
import { setSessionCookie } from "@/server/auth/sessionCookie";
import { toPharmUser } from "@/server/auth/pharmUser";
import { completeOwnerSetup, readOwnerSetupRequired } from "@/server/db/authRepository";

export async function GET() {
  try {
    return Response.json({ setupRequired: await readOwnerSetupRequired() });
  } catch {
    return Response.json({ error: "Unable to check owner access setup." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Owner setup details are invalid." }, { status: 400 });
  }
  const input = parseOwnerSetupInput(body);
  if (!input) return Response.json({ error: "Owner setup details are invalid." }, { status: 400 });

  try {
    const account = await completeOwnerSetup(input, await hashPassword(input.password));
    if (!account) {
      return Response.json({ error: "Owner access has already been set up." }, { status: 409 });
    }
    const token = await establishSession(account.id);
    const response = Response.json({ user: toPharmUser(account) }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = String(error);
    const status = message.includes("unique") || message.includes("23505") ? 409 : 500;
    return Response.json({
      error: status === 409 ? "That username is already in use." : "Unable to complete owner access setup.",
    }, { status });
  }
}
