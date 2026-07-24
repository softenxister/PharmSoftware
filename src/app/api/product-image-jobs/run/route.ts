import { requireStoreOwner } from "@/server/auth/pharmUser";
import {
  readProductImageStatusCounts,
  runProductImageBatch,
} from "@/server/product-images/repository";
import { parseProductImageBatchInput } from "@/server/product-images/reviewContract";

export async function POST(request: Request) {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image job permission denied." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Product image batch details are invalid." }, { status: 400 });
  }
  const input = parseProductImageBatchInput(body);
  if (!input) return Response.json({ error: "Batch size must be a whole number from 1 to 50." }, { status: 400 });

  try {
    const processed = await runProductImageBatch(input.batchSize);
    return Response.json({ data: { processed, counts: await readProductImageStatusCounts() } });
  } catch {
    return Response.json({ error: "Unable to run the product image batch." }, { status: 500 });
  }
}
