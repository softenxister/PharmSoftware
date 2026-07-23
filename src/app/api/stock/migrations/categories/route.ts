import {
  isAuthenticationError,
  requireStockManager,
} from "@/server/auth/pharmUser";
import { normalizeAllProductCategories } from "@/server/db/productCategoryNormalizationRepository";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST() {
  try {
    await requireStockManager();
    const result = await normalizeAllProductCategories();
    return Response.json({ data: result });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse(
        "PERMISSION_DENIED",
        "Only an owner can normalize product categories.",
        403,
      );
    }
    console.error("Product category normalization failed", error);
    return errorResponse(
      "NORMALIZATION_FAILED",
      "Product categories could not be normalized.",
      500,
    );
  }
}
