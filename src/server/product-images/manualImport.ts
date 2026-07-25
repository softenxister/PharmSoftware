import { randomUUID } from "node:crypto";
import {
  Prisma,
  ProductImageCandidateStatus,
  ProductImageResolutionStatus,
} from "@/generated/prisma/client";
import type { ValidatedProductImage } from "./resolver";
import { productImageUrl } from "./placeholder";
import {
  buildProductImageStorageKey,
  createS3ProductImageStorage,
  loadS3Config,
} from "./s3Storage";
import {
  fetchValidatedManualProductImage,
  parseManualProductImageUrl,
} from "./secureFetch";

const MANUAL_IMAGE_PROVIDER = "MANUAL_URL";
const MANUAL_IMAGE_LICENCE = "USER_PROVIDED";

export class ManualProductImageImportError extends Error {
  constructor() {
    super("Photo could not be imported from that URL.");
  }
}

export type PreparedManualProductImage = {
  sourceUrl: string;
  storageKey: string;
  image: ValidatedProductImage;
};

type ManualProductImagePersistenceInput = PreparedManualProductImage & {
  productId: string;
  reviewedBy: string;
  reviewedAt: Date;
};

let verifiedStoragePromise: Promise<ReturnType<typeof createS3ProductImageStorage>> | null = null;

function jsonEvidence(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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

export function buildManualProductImagePersistenceData(
  input: ManualProductImagePersistenceInput,
) {
  const evidence = jsonEvidence({
    decision: "MANUAL_SELECTION",
    autoPublishEligible: false,
    score: 100,
    agreements: ["manualSelection"],
    missing: [],
    conflicts: [],
  });
  const sharedSource = {
    provider: MANUAL_IMAGE_PROVIDER,
    sourcePageUrl: input.sourceUrl,
    sourceImageUrl: input.sourceUrl,
    sourceLicence: MANUAL_IMAGE_LICENCE,
  };

  return {
    candidate: {
      status: ProductImageCandidateStatus.APPROVED,
      ...sharedSource,
      matchMethod: "MANUAL_SELECTION",
      sourceIdentifierType: null,
      sourceIdentifierValue: null,
      sourceProductName: null,
      sourceBrand: null,
      sourceManufacturer: null,
      sourceMarket: null,
      evidence,
      score: 100,
      autoPublishEligible: false,
      imageMimeType: input.image.metadata.mimeType,
      imageWidth: input.image.metadata.width,
      imageHeight: input.image.metadata.height,
      imageByteSize: input.image.metadata.byteSize,
      rejectionReason: null,
      reviewedBy: input.reviewedBy,
      reviewedAt: input.reviewedAt,
    },
    asset: {
      storageKey: input.storageKey,
      mimeType: input.image.metadata.mimeType,
      width: input.image.metadata.width,
      height: input.image.metadata.height,
      byteSize: input.image.metadata.byteSize,
      sha256: input.image.sha256,
      ...sharedSource,
      matchedIdentifierType: null,
      matchedIdentifierValue: null,
      evidence,
      verifiedAt: input.reviewedAt,
      reviewedBy: input.reviewedBy,
    },
    product: {
      imageUrl: productImageUrl(input.productId, input.image.sha256),
      imageResolutionStatus: ProductImageResolutionStatus.VERIFIED,
      imageCheckedAt: input.reviewedAt,
      imageRetryAt: null,
      imageResolutionError: null,
    },
  };
}

export async function prepareManualProductImageImport(
  productId: string,
  photoUrl: string,
): Promise<PreparedManualProductImage | null> {
  let source: URL | null;
  try {
    source = parseManualProductImageUrl(photoUrl);
  } catch {
    throw new ManualProductImageImportError();
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
    throw new ManualProductImageImportError();
  }
}

export async function persistManualProductImageImport(
  tx: Prisma.TransactionClient,
  input: PreparedManualProductImage & {
    productId: string;
    reviewedBy: string;
  },
): Promise<void> {
  const records = buildManualProductImagePersistenceData({
    ...input,
    reviewedAt: new Date(),
  });
  const candidate = await tx.productImageCandidate.upsert({
    where: {
      productId_provider_sourceImageUrl: {
        productId: input.productId,
        provider: records.candidate.provider,
        sourceImageUrl: records.candidate.sourceImageUrl,
      },
    },
    update: records.candidate,
    create: {
      id: `product-image-candidate-${randomUUID()}`,
      productId: input.productId,
      ...records.candidate,
    },
    select: { id: true },
  });

  await tx.productImageAsset.upsert({
    where: { productId: input.productId },
    update: {
      candidateId: candidate.id,
      ...records.asset,
    },
    create: {
      id: `product-image-asset-${randomUUID()}`,
      productId: input.productId,
      candidateId: candidate.id,
      ...records.asset,
    },
  });
  await tx.productImageCandidate.updateMany({
    where: {
      productId: input.productId,
      id: { not: candidate.id },
      status: ProductImageCandidateStatus.PENDING,
    },
    data: {
      status: ProductImageCandidateStatus.REJECTED,
      rejectionReason: "Superseded by the manually selected image.",
      reviewedBy: input.reviewedBy,
      reviewedAt: records.candidate.reviewedAt,
    },
  });
  await tx.product.update({
    where: { id: input.productId },
    data: records.product,
  });
}
