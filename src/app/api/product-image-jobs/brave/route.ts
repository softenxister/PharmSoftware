import { requireStoreOwner } from "@/server/auth/pharmUser";
import { parseBraveImageSearchRunInput } from "@/server/product-images/braveJobContract";
import { braveImageSearchIsConfigured } from "@/server/product-images/providers/braveImageSearch";
import {
  ProductImageJobAlreadyRunningError,
  readBraveImageSearchEligibility,
  runBraveImageSearch,
} from "@/server/product-images/repository";

export async function GET() {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image job permission denied." }, { status: 403 });
  }
  try {
    return Response.json({ data: await readBraveImageSearchEligibility() });
  } catch {
    return Response.json({ error: "Unable to load Brave image search eligibility." }, { status: 500 });
  }
}

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
    return Response.json({ error: "Brave image search details are invalid." }, { status: 400 });
  }
  const input = parseBraveImageSearchRunInput(body);
  if (!input) {
    return Response.json({
      error: "Limit must be a whole number from 1 to 1000.",
    }, { status: 400 });
  }
  if (!braveImageSearchIsConfigured()) {
    return Response.json({
      error: "Brave Image Search is not configured on this server.",
    }, { status: 409 });
  }

  try {
    return Response.json({ data: await runBraveImageSearch(input.limit) });
  } catch (error) {
    if (error instanceof ProductImageJobAlreadyRunningError) {
      return Response.json({ error: "A Brave image search is already running." }, { status: 409 });
    }
    return Response.json({ error: "Unable to run Brave image search." }, { status: 500 });
  }
}
