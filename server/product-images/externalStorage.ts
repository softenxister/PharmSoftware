import { randomUUID } from "node:crypto";
import type { Prisma } from "@server/generated/prisma/client";
import { prisma } from "@server/db/prisma";
import { productImageUrl } from "./placeholder";
import {
  buildProductImageStorageKey,
  buildProductImageStoragePrefix,
  createS3ProductImageStorage,
  loadS3Config,
} from "./s3Storage";
import {
  fetchValidatedManualProductImage,
  parseManualProductImageUrl,
} from "./secureFetch";

export class ExternalProductImageStorageError extends Error {
  constructor() {
    super("Photo could not be stored from that URL.");
  }
}

export type PreparedExternalProductImage = {
  sourceUrl: string;
  storageKey: string;
  image: NonNullable<Awaited<ReturnType<typeof fetchValidatedManualProductImage>>>;
};

let verifiedStoragePromise: Promise<ReturnType<typeof createS3ProductImageStorage>> | null = null;

async function verifiedStorage() {
  if (!verifiedStoragePromise) {
    verifiedStoragePromise = (async () => {
      const storage = createS3ProductImageStorage({ config: loadS3Config() });
      await storage.verifyPrivateBucket();
      return storage;
    })().catch((error) => {
      verifiedStoragePromise = null;
      throw error;
    });
  }
  return verifiedStoragePromise;
}

export async function cleanupStoredProductImageObjects(
  productId: string,
  keepKey: string,
  storage?: Pick<ReturnType<typeof createS3ProductImageStorage>, "deleteOtherObjects">,
): Promise<void> {
  const target = storage ?? await verifiedStorage();
  await target.deleteOtherObjects(buildProductImageStoragePrefix(productId), keepKey);
}

export function buildStoredProductImagePersistenceData(
  input: PreparedExternalProductImage & { productId: string },
) {
  return {
    asset: {
      storageKey: input.storageKey,
      mimeType: input.image.metadata.mimeType,
      width: input.image.metadata.width,
      height: input.image.metadata.height,
      byteSize: input.image.metadata.byteSize,
      sha256: input.image.sha256,
      sourceImageUrl: input.sourceUrl,
    },
    product: {
      imageUrl: productImageUrl(input.productId, input.image.sha256),
    },
  };
}

export async function prepareExternalProductImageStorage(
  productId: string,
  photoUrl: string,
): Promise<PreparedExternalProductImage | null> {
  let source: URL | null;
  try {
    source = parseManualProductImageUrl(photoUrl);
  } catch {
    throw new ExternalProductImageStorageError();
  }
  if (!source) return null;

  try {
    const image = await fetchValidatedManualProductImage(source.toString());
    if (!image) return null;
    const storageKey = buildProductImageStorageKey(
      productId,
      image.sha256,
      image.metadata.mimeType,
    );
    const storage = await verifiedStorage();
    await storage.putObject(storageKey, image.bytes, image.metadata.mimeType);
    return {
      sourceUrl: source.toString(),
      storageKey,
      image,
    };
  } catch {
    throw new ExternalProductImageStorageError();
  }
}

export async function persistStoredProductImage(
  tx: Prisma.TransactionClient,
  input: PreparedExternalProductImage & { productId: string },
): Promise<void> {
  const records = buildStoredProductImagePersistenceData(input);
  await tx.productImageAsset.upsert({
    where: { productId: input.productId },
    update: records.asset,
    create: {
      id: `product-image-asset-${randomUUID()}`,
      productId: input.productId,
      ...records.asset,
    },
  });
  await tx.product.update({
    where: { id: input.productId },
    data: records.product,
  });
}

export async function readProductImageAsset(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      brandName: true,
      updatedAt: true,
      imageAsset: {
        select: {
          storageKey: true,
          mimeType: true,
          byteSize: true,
          sha256: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function readStoredProductImage(storageKey: string): Promise<Response> {
  return (await verifiedStorage()).getObject(storageKey);
}
