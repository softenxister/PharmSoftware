import {
  readPurchaseBill,
  readPurchaseBills,
  savePurchaseBill,
  type PurchaseBillInput,
} from "@server/db/purchaseRepository";
import { isValidPurchaseBillInput } from "@server/db/purchaseValidation";
import { isAuthenticationError, requireAuthenticatedUser } from "@server/auth/pharmUser";

const purchaseErrorResponse = (error: unknown) => {
  if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
  const message = error instanceof Error && /^(A purchase|Purchase)/.test(error.message)
    ? error.message
    : "Unable to save purchase bill.";
  return Response.json({ error: message }, { status: 400 });
};

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (id) {
      const bill = await readPurchaseBill(id);
      if (!bill) return Response.json({ error: "Purchase bill was not found." }, { status: 404 });
      return Response.json({ bill });
    }
    const bills = await readPurchaseBills();
    return Response.json({ bills });
  } catch (error) {
    if (isAuthenticationError(error)) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Unable to load purchase bills." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!isValidPurchaseBillInput(body)) {
      return Response.json({ error: "Purchase bill data is invalid." }, { status: 400 });
    }
    const result = await savePurchaseBill(body as PurchaseBillInput);
    return Response.json(result);
  } catch (error) {
    return purchaseErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!isValidPurchaseBillInput(body, { requireId: true })) {
      return Response.json({ error: "Purchase bill data is invalid." }, { status: 400 });
    }
    const result = await savePurchaseBill(body as PurchaseBillInput);
    return Response.json(result);
  } catch (error) {
    return purchaseErrorResponse(error);
  }
}
