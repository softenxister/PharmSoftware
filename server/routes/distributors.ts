import { readDistributorNames } from "@server/db/purchaseRepository";
import { requireAuthenticatedUser } from "@server/auth/pharmUser";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    return Response.json({ distributors: await readDistributorNames() });
  } catch (error) {
    if (error instanceof Error && /required/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Unable to load distributors." }, { status: 500 });
  }
}
