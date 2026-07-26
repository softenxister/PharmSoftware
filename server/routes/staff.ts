import { parseStaffActionInput, parseStaffCreateInput } from "@server/auth/accountValidation";
import { hashPassword } from "@server/auth/password";
import { requireStoreOwner } from "@server/auth/pharmUser";
import {
  createPharmacistAccount,
  listPharmacistAccounts,
  resetPharmacistPassword,
  setPharmacistActive,
} from "@server/db/authRepository";

async function ownerOrResponse() {
  try {
    return await requireStoreOwner();
  } catch {
    return Response.json({ error: "Staff management permission denied." }, { status: 403 });
  }
}

export async function GET() {
  const owner = await ownerOrResponse();
  if (owner instanceof Response) return owner;
  try {
    return Response.json({ staff: await listPharmacistAccounts() });
  } catch {
    return Response.json({ error: "Unable to load staff accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await ownerOrResponse();
  if (owner instanceof Response) return owner;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Staff account details are invalid." }, { status: 400 });
  }
  const input = parseStaffCreateInput(body);
  if (!input) return Response.json({ error: "Staff account details are invalid." }, { status: 400 });

  try {
    const staff = await createPharmacistAccount(input, await hashPassword(input.password), owner.id);
    return Response.json({ staff }, { status: 201 });
  } catch (error) {
    const message = String(error);
    const status = message.includes("unique") || message.includes("23505") ? 409 : 500;
    return Response.json({
      error: status === 409 ? "That username is already in use." : "Unable to create the staff account.",
    }, { status });
  }
}

export async function PATCH(request: Request) {
  const owner = await ownerOrResponse();
  if (owner instanceof Response) return owner;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Staff action is invalid." }, { status: 400 });
  }
  const input = parseStaffActionInput(body);
  if (!input) return Response.json({ error: "Staff action is invalid." }, { status: 400 });

  try {
    const changed = input.action === "set-active"
      ? await setPharmacistActive(input.staffId, input.isActive)
      : await resetPharmacistPassword(input.staffId, await hashPassword(input.password));
    if (!changed) return Response.json({ error: "Staff account was not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to update the staff account." }, { status: 500 });
  }
}
