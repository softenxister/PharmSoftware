import { requireAuthenticatedUser } from "@/server/auth/pharmUser";
import {
  createMember,
  listMembers,
  readMember,
  updateMember,
} from "@/server/db/memberRepository";
import { parseMemberProfileInput } from "@/server/db/memberValidation";
import { ingredientIdsExist } from "@/server/db/ingredientRepository";

async function authenticatedOrResponse() {
  try {
    return await requireAuthenticatedUser();
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
}

function memberIdFrom(request: Request, body?: Record<string, unknown>): string {
  const queryId = new URL(request.url).searchParams.get("memberId")?.trim();
  return queryId || (typeof body?.memberId === "string" ? body.memberId.trim() : "");
}

function isUniqueConflict(error: unknown): boolean {
  const message = String(error);
  return message.includes("unique") || message.includes("P2002") || message.includes("23505");
}

export async function GET(request: Request) {
  const authenticated = await authenticatedOrResponse();
  if (authenticated instanceof Response) return authenticated;
  try {
    const memberId = memberIdFrom(request);
    if (!memberId) return Response.json({ members: await listMembers() });
    const member = await readMember(memberId);
    if (!member) return Response.json({ error: "Member was not found." }, { status: 404 });
    return Response.json({ member });
  } catch {
    return Response.json({ error: "Unable to load members." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authenticated = await authenticatedOrResponse();
  if (authenticated instanceof Response) return authenticated;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Member details are invalid." }, { status: 400 });
  }
  const input = parseMemberProfileInput(body);
  if (!input) return Response.json({ error: "Enter a valid name and Thai phone number." }, { status: 400 });
  if (input.allergyIngredientIds && !await ingredientIdsExist(input.allergyIngredientIds)) {
    return Response.json({ error: "One or more allergy ingredients are invalid." }, { status: 400 });
  }
  try {
    return Response.json({ member: await createMember(input) }, { status: 201 });
  } catch (error) {
    return Response.json({
      error: isUniqueConflict(error) ? "That mobile number already belongs to a member." : "Unable to create member.",
    }, { status: isUniqueConflict(error) ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  const authenticated = await authenticatedOrResponse();
  if (authenticated instanceof Response) return authenticated;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Member details are invalid." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : undefined;
  const memberId = memberIdFrom(request, record);
  const input = parseMemberProfileInput(body);
  if (!memberId || !input) return Response.json({ error: "Member details are invalid." }, { status: 400 });
  if (input.allergyIngredientIds && !await ingredientIdsExist(input.allergyIngredientIds)) {
    return Response.json({ error: "One or more allergy ingredients are invalid." }, { status: 400 });
  }
  try {
    const member = await updateMember(memberId, input);
    if (!member) return Response.json({ error: "Member was not found." }, { status: 404 });
    return Response.json({ member });
  } catch (error) {
    return Response.json({
      error: isUniqueConflict(error) ? "That mobile number already belongs to a member." : "Unable to update member.",
    }, { status: isUniqueConflict(error) ? 409 : 500 });
  }
}
