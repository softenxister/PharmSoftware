import {
  isAuthenticationError,
  requireStockManager,
} from "@server/auth/pharmUser";
import { normalizeAllProductMeasurements } from "@server/db/productMeasurementNormalizationRepository";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST() {
  try {
    await requireStockManager();
    const result = await normalizeAllProductMeasurements();
    return Response.json({ data: result });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return errorResponse("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error instanceof Error && error.message === "Purchase permission denied.") {
      return errorResponse(
        "PERMISSION_DENIED",
        "Only an owner can normalize product measurements.",
        403,
      );
    }
    console.error("Product measurement normalization failed", error);
    return errorResponse(
      "NORMALIZATION_FAILED",
      "Product measurements could not be normalized.",
      500,
    );
  }
}
