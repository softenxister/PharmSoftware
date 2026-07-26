import { getCurrentPharmUser } from "@server/auth/pharmUser";

export async function GET() {
  const user = await getCurrentPharmUser();
  return user
    ? Response.json({ user })
    : Response.json({ error: "Authentication required." }, { status: 401 });
}
