import { prisma } from "@/server/db/prisma";
import {
  analyzeProductImageVersions,
  type ProductImageStorageRecord,
} from "./storageMaintenance";
import { createS3ProductImageStorage, loadS3Config } from "./s3Storage";

export const PRODUCT_IMAGE_MAINTENANCE_BATCH_SIZE = 500;
const CLEANUP_CONCURRENCY = 3;

export type ProductImageCleanupPreview = {
  batchCursor: string | null;
  nextCursor: string | null;
  scannedCount: number;
  duplicateProductCount: number;
  oldVersionCount: number;
  orphanedObjectCount: number;
  unsafeProductCount: number;
};

export type ProductImageCleanupResult = ProductImageCleanupPreview & {
  deletedVersionCount: number;
  cleanupFailedCount: number;
};

function cleanCursor(cursor: string | null | undefined): string | null {
  const value = cursor?.trim();
  if (!value) return null;
  if (value.length > 200) throw new Error("Product image cleanup cursor is invalid.");
  return value;
}

async function readBatch(cursor?: string | null): Promise<{
  batchCursor: string | null;
  nextCursor: string | null;
  products: ProductImageStorageRecord[];
}> {
  const batchCursor = cleanCursor(cursor);
  const rows = await prisma.product.findMany({
    where: batchCursor ? { id: { gt: batchCursor } } : undefined,
    select: {
      id: true,
      imageAsset: { select: { storageKey: true } },
    },
    orderBy: { id: "asc" },
    take: PRODUCT_IMAGE_MAINTENANCE_BATCH_SIZE + 1,
  });
  const hasNext = rows.length > PRODUCT_IMAGE_MAINTENANCE_BATCH_SIZE;
  const batch = rows.slice(0, PRODUCT_IMAGE_MAINTENANCE_BATCH_SIZE);
  return {
    batchCursor,
    nextCursor: hasNext ? batch.at(-1)?.id ?? null : null,
    products: batch.map((product) => ({
      productId: product.id,
      storageKey: product.imageAsset?.storageKey ?? null,
    })),
  };
}

async function inspectBatch(cursor?: string | null) {
  const batch = await readBatch(cursor);
  const storage = createS3ProductImageStorage({ config: loadS3Config() });
  await storage.verifyPrivateBucket();
  const versions = await storage.listObjectVersions();
  return {
    ...batch,
    storage,
    analysis: analyzeProductImageVersions(batch.products, versions),
  };
}

function previewFromInspection(
  inspection: Awaited<ReturnType<typeof inspectBatch>>,
): ProductImageCleanupPreview {
  return {
    batchCursor: inspection.batchCursor,
    nextCursor: inspection.nextCursor,
    scannedCount: inspection.products.length,
    duplicateProductCount: inspection.analysis.duplicateProductCount,
    oldVersionCount: inspection.analysis.deletableVersions.length,
    orphanedObjectCount: inspection.analysis.orphanedObjectCount,
    unsafeProductCount: inspection.analysis.unsafeProductCount,
  };
}

export async function previewProductImageCleanup(
  cursor?: string | null,
): Promise<ProductImageCleanupPreview> {
  return previewFromInspection(await inspectBatch(cursor));
}

export async function cleanProductImageDuplicates(
  cursor?: string | null,
): Promise<ProductImageCleanupResult> {
  const inspection = await inspectBatch(cursor);
  const versions = inspection.analysis.deletableVersions;
  let nextIndex = 0;
  let deletedVersionCount = 0;
  let cleanupFailedCount = 0;

  async function deleteNext(): Promise<void> {
    while (nextIndex < versions.length) {
      const version = versions[nextIndex];
      nextIndex += 1;
      try {
        await inspection.storage.deleteObjectVersion(version);
        deletedVersionCount += 1;
      } catch {
        cleanupFailedCount += 1;
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(CLEANUP_CONCURRENCY, versions.length) },
    () => deleteNext(),
  ));

  return {
    ...previewFromInspection(inspection),
    deletedVersionCount,
    cleanupFailedCount,
  };
}
