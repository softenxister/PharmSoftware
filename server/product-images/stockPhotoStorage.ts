import { Prisma } from "@server/generated/prisma/client";
import { prisma } from "@server/db/core/prisma";
import {
  cleanupStoredProductImageObjects,
  persistStoredProductImage,
  prepareExternalProductImageStorage,
} from "./externalStorage";
import { productImageUrl } from "./placeholder";
import {
  bulkProductImageFailedItems,
  bulkProductImageWorkerCount,
  classifyBulkProductImageUrl,
  type BulkProductImageFailedItem,
} from "./storageMaintenance";

export type BulkStockPhotoStorageResult = {
  eligibleCount: number;
  processedCount: number;
  storedCount: number;
  repairedCount: number;
  failedCount: number;
  remainingCount: number;
  cleanupWarningCount: number;
  failedItems: BulkProductImageFailedItem[];
};

const STOCK_PHOTO_IMPORT_BATCH_SIZE = 500;

const bulkPhotoCandidateWhere: Prisma.ProductWhereInput = {
  isActive: true,
  OR: [
    { imageUrl: { startsWith: "https://" } },
    {
      AND: [
        { imageUrl: { startsWith: "http://" } },
        { imageUrl: { contains: "/api/product-images/" } },
      ],
    },
  ],
  NOT: [
    { imageUrl: { contains: "placehold.co" } },
    { imageUrl: { contains: "placeholder.com" } },
    { imageUrl: { contains: "placehold.it" } },
  ],
};

export async function storeAllExternalStockPhotos(): Promise<BulkStockPhotoStorageResult> {
  const [candidateCount, products] = await Promise.all([
    prisma.product.count({ where: bulkPhotoCandidateWhere }),
    prisma.product.findMany({
      where: bulkPhotoCandidateWhere,
      select: {
        id: true,
        itemName: true,
        imageUrl: true,
        imageAsset: {
          select: { storageKey: true, sha256: true, sourceImageUrl: true },
        },
      },
      orderBy: [{ itemName: "asc" }, { id: "asc" }],
      take: STOCK_PHOTO_IMPORT_BATCH_SIZE,
    }),
  ]);
  const failedProductIds = new Set<string>();
  const eligibleProducts = products.flatMap((product) => {
    const classification = classifyBulkProductImageUrl(product.id, product.imageUrl);
    if (classification) return [{ ...product, classification }];
    failedProductIds.add(product.id);
    return [];
  });
  let nextIndex = 0;
  let storedCount = 0;
  let repairedCount = 0;
  let cleanupWarningCount = 0;

  async function importNextPhoto(): Promise<void> {
    while (nextIndex < eligibleProducts.length) {
      const product = eligibleProducts[nextIndex];
      nextIndex += 1;
      try {
        const canonicalUrl = product.imageAsset
          ? productImageUrl(product.id, product.imageAsset.sha256)
          : productImageUrl(product.id);
        if (
          product.classification.kind === "managed"
          || (
            product.imageAsset
            && product.classification.kind === "external"
            && product.imageAsset.sourceImageUrl === product.classification.sourceUrl
          )
        ) {
          await prisma.product.update({
            where: { id: product.id },
            data: { imageUrl: canonicalUrl },
          });
          repairedCount += 1;
          if (product.imageAsset) {
            try {
              await cleanupStoredProductImageObjects(product.id, product.imageAsset.storageKey);
            } catch {
              cleanupWarningCount += 1;
            }
          }
          continue;
        }

        const prepared = await prepareExternalProductImageStorage(
          product.id,
          product.classification.sourceUrl,
        );
        if (!prepared) throw new Error("A public external photo URL is required.");
        await prisma.$transaction((tx) => persistStoredProductImage(tx, {
          ...prepared,
          productId: product.id,
        }));
        storedCount += 1;
        try {
          await cleanupStoredProductImageObjects(product.id, prepared.storageKey);
        } catch {
          cleanupWarningCount += 1;
        }
      } catch {
        failedProductIds.add(product.id);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: bulkProductImageWorkerCount(eligibleProducts.length) },
      () => importNextPhoto(),
    ),
  );
  const failedItems = bulkProductImageFailedItems(products, failedProductIds);
  return {
    eligibleCount: candidateCount,
    processedCount: products.length,
    storedCount,
    repairedCount,
    failedCount: failedItems.length,
    remainingCount: Math.max(0, candidateCount - products.length),
    cleanupWarningCount,
    failedItems,
  };
}
