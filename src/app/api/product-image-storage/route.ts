import { requireStoreOwner } from "@/server/auth/pharmUser";
import {
  cleanProductImageDuplicates,
  previewProductImageCleanup,
} from "@/server/product-images/storageMaintenanceRepository";

function requestCursor(request: Request): string | null {
  return new URL(request.url).searchParams.get("cursor");
}

export async function GET(request: Request) {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image storage permission denied." }, { status: 403 });
  }
  try {
    return Response.json({ data: await previewProductImageCleanup(requestCursor(request)) });
  } catch {
    return Response.json({ error: "Unable to inspect stored product images." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireStoreOwner();
  } catch {
    return Response.json({ error: "Product image storage permission denied." }, { status: 403 });
  }
  try {
    return Response.json({ data: await cleanProductImageDuplicates(requestCursor(request)) });
  } catch {
    return Response.json({ error: "Unable to clean stored product images." }, { status: 500 });
  }
}
