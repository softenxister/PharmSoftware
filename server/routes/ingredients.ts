import { requireAuthenticatedUser } from "@server/auth/pharmUser";
import { searchIngredients } from "@server/db/composition/ingredientRepository";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 120) {
    return Response.json({ error: "Ingredient search is too long." }, { status: 400 });
  }

  try {
    return Response.json({ ingredients: await searchIngredients(query) });
  } catch {
    return Response.json({ error: "Unable to search ingredients." }, { status: 500 });
  }
}
