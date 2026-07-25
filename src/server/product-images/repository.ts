import { randomUUID } from "node:crypto";
import {
  Prisma,
  ProductIdentifierType,
  ProductImageCandidateStatus,
  ProductImageResolutionStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { normalizeGtin } from "./identity";
import { productImageUrl } from "./placeholder";
import {
  selectBraveImageSearchEligibleProducts,
  type BraveImageSearchEligibleProduct,
} from "./braveEligibility";
import { MAX_BRAVE_IMAGE_SEARCH_PRODUCTS } from "./braveJobContract";
import {
  BRAVE_IMAGE_SEARCH_HOSTS,
  BRAVE_IMAGE_SEARCH_PROVIDER,
  BraveImageSearchRequestError,
  braveImageSearchIsConfigured,
  createBraveImageSearchClient,
  type BraveImageSearchRateLimit,
} from "./providers/braveImageSearch";
import {
  candidateHasValidatedPreview,
  fetchBraveCandidateImage,
} from "./providers/braveImageFetch";
import { createOpenProductsFactsProvider } from "./providers/openProductsFacts";
import type { ProductImageProviderCandidate } from "./providers/types";
import {
  resolveOneProductImage,
  type ResolvableProduct,
  type SavedCandidateInput,
  type ValidatedProductImage,
} from "./resolver";
import {
  buildProductImageStorageKey,
  buildProductImageStoragePrefix,
  createS3ProductImageStorage,
  loadS3Config,
} from "./s3Storage";
import { fetchValidatedProductImage } from "./secureFetch";
import { openProductsFactsImageResolutionIsEnabled } from "./config";

const RETRY_DELAY_MS = 24 * 60 * 60 * 1_000;
const UNRESOLVED_RECHECK_MS = 30 * 24 * 60 * 60 * 1_000;
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const BRAVE_RETRY_DELAY_MS = 24 * 60 * 60 * 1_000;
const BRAVE_CONCURRENCY = 5;
const BRAVE_NO_RESULT_MARKER = "BRAVE_IMAGE_SEARCH_NO_RESULT";
const BRAVE_RETRY_MARKER = "BRAVE_IMAGE_SEARCH_RETRY";

export class ProductImageCandidateStateError extends Error {}
export class ProductImageCandidateNotFoundError extends Error {}
export class ProductImageJobAlreadyRunningError extends Error {}

const provider = createOpenProductsFactsProvider();
let verifiedStoragePromise: Promise<ReturnType<typeof createS3ProductImageStorage>> | null = null;
let runningBatch: Promise<number> | null = null;
let runningBraveImageSearch: Promise<BraveImageSearchRunResult> | null = null;

function boundedReason(reason: string): string {
  return reason.replace(/\s+/g, " ").trim().slice(0, 500);
}

function configuredStorage() {
  try {
    return createS3ProductImageStorage({ config: loadS3Config() });
  } catch {
    return null;
  }
}

function allowedImageHostsForProvider(providerName: string): readonly string[] {
  if (providerName === provider.name) return provider.allowedImageHosts;
  if (providerName === BRAVE_IMAGE_SEARCH_PROVIDER) return BRAVE_IMAGE_SEARCH_HOSTS;
  throw new Error("The product image provider is not enabled.");
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

function jsonEvidence(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function saveCandidate(input: SavedCandidateInput): Promise<string> {
  const candidate = input.candidate;
  const saved = await prisma.productImageCandidate.upsert({
    where: {
      productId_provider_sourceImageUrl: {
        productId: input.productId,
        provider: candidate.provider,
        sourceImageUrl: candidate.sourceImageUrl,
      },
    },
    update: {
      status: input.status,
      sourcePageUrl: candidate.sourcePageUrl,
      sourceLicence: candidate.sourceLicence,
      matchMethod: candidate.matchMethod,
      sourceIdentifierType: candidate.sourceIdentifierType,
      sourceIdentifierValue: candidate.sourceIdentifierValue,
      sourceProductName: candidate.sourceProductName,
      sourceBrand: candidate.sourceBrand,
      sourceManufacturer: candidate.sourceManufacturer,
      sourceMarket: candidate.sourceMarket,
      evidence: jsonEvidence(input.evidence),
      score: input.evidence.score,
      autoPublishEligible: input.evidence.autoPublishEligible,
      imageMimeType: input.image?.mimeType,
      imageWidth: input.image?.width,
      imageHeight: input.image?.height,
      imageByteSize: input.image?.byteSize,
      rejectionReason: input.rejectionReason ?? null,
      reviewedBy: input.status === "REJECTED" ? "system" : null,
      reviewedAt: input.status === "REJECTED" ? new Date() : null,
    },
    create: {
      id: `product-image-candidate-${randomUUID()}`,
      productId: input.productId,
      status: input.status,
      provider: candidate.provider,
      sourcePageUrl: candidate.sourcePageUrl,
      sourceImageUrl: candidate.sourceImageUrl,
      sourceLicence: candidate.sourceLicence,
      matchMethod: candidate.matchMethod,
      sourceIdentifierType: candidate.sourceIdentifierType,
      sourceIdentifierValue: candidate.sourceIdentifierValue,
      sourceProductName: candidate.sourceProductName,
      sourceBrand: candidate.sourceBrand,
      sourceManufacturer: candidate.sourceManufacturer,
      sourceMarket: candidate.sourceMarket,
      evidence: jsonEvidence(input.evidence),
      score: input.evidence.score,
      autoPublishEligible: input.evidence.autoPublishEligible,
      imageMimeType: input.image?.mimeType,
      imageWidth: input.image?.width,
      imageHeight: input.image?.height,
      imageByteSize: input.image?.byteSize,
      rejectionReason: input.rejectionReason,
      reviewedBy: input.status === "REJECTED" ? "system" : null,
      reviewedAt: input.status === "REJECTED" ? new Date() : null,
    },
    select: { id: true },
  });
  if (input.status === "PENDING") {
    await prisma.product.update({
      where: { id: input.productId },
      data: {
        imageResolutionStatus: ProductImageResolutionStatus.REVIEW,
        imageCheckedAt: new Date(),
        imageRetryAt: null,
        imageResolutionError: null,
        imageUrl: productImageUrl(input.productId),
      },
    });
  }
  return saved.id;
}

async function activateCandidate(input: {
  productId: string;
  candidateId: string;
  candidate: ProductImageProviderCandidate;
  image: ValidatedProductImage;
  reviewedBy?: string | null;
}): Promise<void> {
  const storage = await verifiedStorage();
  const storageKey = buildProductImageStorageKey(
    input.productId,
    input.image.sha256,
    input.image.metadata.mimeType,
  );
  await storage.putObject(storageKey, input.image.bytes, input.image.metadata.mimeType);

  await prisma.$transaction(async (tx) => {
    const current = await tx.productImageCandidate.findUnique({
      where: { id: input.candidateId },
      select: { status: true, evidence: true },
    });
    if (!current) throw new ProductImageCandidateNotFoundError("Product image candidate was not found.");
    if (current.status !== ProductImageCandidateStatus.PENDING) {
      throw new ProductImageCandidateStateError("Product image candidate has already been reviewed.");
    }
    const reviewedAt = new Date();
    await tx.productImageAsset.upsert({
      where: { productId: input.productId },
      update: {
        candidateId: input.candidateId,
        storageKey,
        mimeType: input.image.metadata.mimeType,
        width: input.image.metadata.width,
        height: input.image.metadata.height,
        byteSize: input.image.metadata.byteSize,
        sha256: input.image.sha256,
        provider: input.candidate.provider,
        sourcePageUrl: input.candidate.sourcePageUrl,
        sourceImageUrl: input.candidate.sourceImageUrl,
        sourceLicence: input.candidate.sourceLicence,
        matchedIdentifierType: input.candidate.sourceIdentifierType,
        matchedIdentifierValue: input.candidate.sourceIdentifierValue,
        evidence: current.evidence,
        verifiedAt: reviewedAt,
        reviewedBy: input.reviewedBy ?? null,
      },
      create: {
        id: `product-image-asset-${randomUUID()}`,
        productId: input.productId,
        candidateId: input.candidateId,
        storageKey,
        mimeType: input.image.metadata.mimeType,
        width: input.image.metadata.width,
        height: input.image.metadata.height,
        byteSize: input.image.metadata.byteSize,
        sha256: input.image.sha256,
        provider: input.candidate.provider,
        sourcePageUrl: input.candidate.sourcePageUrl,
        sourceImageUrl: input.candidate.sourceImageUrl,
        sourceLicence: input.candidate.sourceLicence,
        matchedIdentifierType: input.candidate.sourceIdentifierType,
        matchedIdentifierValue: input.candidate.sourceIdentifierValue,
        evidence: current.evidence,
        reviewedBy: input.reviewedBy ?? null,
      },
    });
    await tx.productImageCandidate.update({
      where: { id: input.candidateId },
      data: {
        status: ProductImageCandidateStatus.APPROVED,
        reviewedBy: input.reviewedBy ?? "system",
        reviewedAt,
        rejectionReason: null,
      },
    });
    await tx.productImageCandidate.updateMany({
      where: {
        productId: input.productId,
        id: { not: input.candidateId },
        status: ProductImageCandidateStatus.PENDING,
      },
      data: {
        status: ProductImageCandidateStatus.REJECTED,
        rejectionReason: "Superseded by the verified image.",
        reviewedBy: input.reviewedBy ?? "system",
        reviewedAt,
      },
    });
    await tx.product.update({
      where: { id: input.productId },
      data: {
        imageResolutionStatus: ProductImageResolutionStatus.VERIFIED,
        imageCheckedAt: reviewedAt,
        imageRetryAt: null,
        imageResolutionError: null,
        imageUrl: productImageUrl(input.productId, input.image.sha256),
      },
    });
  });
  await storage.deleteOtherObjects(
    buildProductImageStoragePrefix(input.productId),
    storageKey,
  );
}

function toResolvableProduct(row: {
  id: string;
  itemName: string;
  brandName: string;
  barcode: string;
  manufacturer: { name: string };
  barcodeAliases: Array<{ barcode: string }>;
  activeIngredients: Array<{ ingredient: { canonicalName: string } }>;
}): ResolvableProduct {
  return {
    id: row.id,
    itemName: row.itemName,
    brandName: row.brandName,
    manufacturerName: row.manufacturer.name,
    market: "TH",
    barcodes: [
      { value: row.barcode, packageLevel: "EACH" },
      ...row.barcodeAliases.map(({ barcode }) => ({ value: barcode, packageLevel: "EACH" })),
    ],
    ingredientNames: row.activeIngredients.map(({ ingredient }) => ingredient.canonicalName),
  };
}

async function syncIdentifiers(product: ResolvableProduct): Promise<void> {
  const identifiers = product.barcodes.flatMap(({ value, packageLevel }) => {
    const normalizedValue = normalizeGtin(value);
    return normalizedValue ? [{
      id: `product-identifier-${randomUUID()}`,
      productId: product.id,
      type: ProductIdentifierType.GTIN,
      value,
      normalizedValue,
      market: product.market,
      packageLevel,
    }] : [];
  });
  if (identifiers.length > 0) {
    await prisma.productIdentifier.createMany({ data: identifiers, skipDuplicates: true });
  }
}

async function resolveProduct(product: ResolvableProduct, canPublish: boolean): Promise<void> {
  await syncIdentifiers(product);
  await resolveOneProductImage(product, {
    provider,
    canPublish,
    validateImage: (sourceImageUrl, allowedHosts) => fetchValidatedProductImage(
      sourceImageUrl,
      { allowedHosts },
    ),
    saveCandidate,
    publishCandidate: (input) => activateCandidate(input),
    markUnresolved: async (reason) => {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageResolutionStatus: ProductImageResolutionStatus.UNRESOLVED,
          imageCheckedAt: new Date(),
          imageRetryAt: new Date(Date.now() + UNRESOLVED_RECHECK_MS),
          imageResolutionError: boundedReason(reason),
          imageUrl: productImageUrl(product.id),
        },
      });
    },
    markRetry: async (reason) => {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageResolutionStatus: ProductImageResolutionStatus.PENDING,
          imageCheckedAt: new Date(),
          imageRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
          imageResolutionError: boundedReason(reason),
          imageUrl: productImageUrl(product.id),
        },
      });
    },
  });
}

async function runBatch(batchSize: number): Promise<number> {
  const now = new Date();
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        {
          imageResolutionStatus: ProductImageResolutionStatus.PENDING,
          OR: [{ imageRetryAt: null }, { imageRetryAt: { lte: now } }],
        },
        {
          imageResolutionStatus: ProductImageResolutionStatus.UNRESOLVED,
          imageRetryAt: { lte: now },
        },
      ],
    },
    select: {
      id: true,
      itemName: true,
      brandName: true,
      barcode: true,
      manufacturer: { select: { name: true } },
      // A product has one current image. Only base-item identifiers are safe
      // here because the free provider does not return packaging level.
      barcodeAliases: {
        where: { parentPackId: null },
        select: { barcode: true },
      },
      activeIngredients: {
        select: { ingredient: { select: { canonicalName: true } } },
      },
    },
    orderBy: [{ imageRetryAt: "asc" }, { id: "asc" }],
    take: Math.min(MAX_BATCH_SIZE, Math.max(1, Math.trunc(batchSize))),
  });
  const canPublish = configuredStorage() !== null;
  for (const row of rows) {
    const product = toResolvableProduct(row);
    try {
      await resolveProduct(product, canPublish);
    } catch {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageResolutionStatus: ProductImageResolutionStatus.PENDING,
          imageCheckedAt: new Date(),
          imageRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
          imageResolutionError: "The product image resolver could not complete this item.",
          imageUrl: productImageUrl(product.id),
        },
      });
    }
  }
  return rows.length;
}

export async function runProductImageBatch(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  if (!openProductsFactsImageResolutionIsEnabled()) return 0;
  if (!runningBatch) {
    runningBatch = runBatch(batchSize).finally(() => {
      runningBatch = null;
    });
  }
  return runningBatch;
}

async function readBraveImageSearchEligibleProducts(
  limit = Number.POSITIVE_INFINITY,
): Promise<BraveImageSearchEligibleProduct[]> {
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      imageCandidates: {
        none: { provider: BRAVE_IMAGE_SEARCH_PROVIDER },
      },
    },
    select: {
      id: true,
      barcode: true,
      itemName: true,
      imageUrl: true,
      imageResolutionError: true,
      imageRetryAt: true,
      imageAsset: { select: { id: true } },
      batches: { select: { availableStock: true } },
    },
  });
  return selectBraveImageSearchEligibleProducts(rows, limit, {
    noResultMarker: BRAVE_NO_RESULT_MARKER,
    retryMarker: BRAVE_RETRY_MARKER,
  });
}

export async function readBraveImageSearchEligibility() {
  const products = await readBraveImageSearchEligibleProducts();
  return {
    configured: braveImageSearchIsConfigured(),
    eligibleCount: products.length,
    maxPerRun: MAX_BRAVE_IMAGE_SEARCH_PRODUCTS,
  };
}

export type BraveImageSearchRunResult = {
  selected: number;
  queried: number;
  queued: number;
  unresolved: number;
  failed: number;
  eligibleRemaining: number;
  rateLimit: BraveImageSearchRateLimit;
};

function braveReviewEvidence(): SavedCandidateInput["evidence"] {
  return {
    decision: "REVIEW",
    autoPublishEligible: false,
    score: 18,
    agreements: ["barcodeQuery"],
    missing: ["verifiedIdentifier", "sourceLicence"],
    conflicts: [],
  };
}

async function saveBraveNoResult(productId: string): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: {
      imageResolutionStatus: ProductImageResolutionStatus.UNRESOLVED,
      imageCheckedAt: new Date(),
      imageRetryAt: null,
      imageResolutionError: BRAVE_NO_RESULT_MARKER,
      imageUrl: productImageUrl(productId),
    },
  });
}

async function saveBraveRetry(productId: string): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: {
      imageResolutionStatus: ProductImageResolutionStatus.PENDING,
      imageCheckedAt: new Date(),
      imageRetryAt: new Date(Date.now() + BRAVE_RETRY_DELAY_MS),
      imageResolutionError: BRAVE_RETRY_MARKER,
      imageUrl: productImageUrl(productId),
    },
  });
}

async function executeBraveImageSearch(limit: number): Promise<BraveImageSearchRunResult> {
  const products = await readBraveImageSearchEligibleProducts(
    Math.min(MAX_BRAVE_IMAGE_SEARCH_PRODUCTS, Math.max(1, Math.trunc(limit))),
  );
  const client = createBraveImageSearchClient();
  let nextIndex = 0;
  let queried = 0;
  let queued = 0;
  let unresolved = 0;
  let failed = 0;
  let rateLimited = false;
  const rateLimit: BraveImageSearchRateLimit = { remaining: null, resetSeconds: null };

  const worker = async () => {
    while (!rateLimited) {
      const index = nextIndex;
      nextIndex += 1;
      const product = products[index];
      if (!product) return;
      queried += 1;
      try {
        const result = await client.search(product.barcode, product.itemName);
        if (result.rateLimit.remaining !== null) {
          rateLimit.remaining = rateLimit.remaining === null
            ? result.rateLimit.remaining
            : Math.min(rateLimit.remaining, result.rateLimit.remaining);
        }
        if (result.rateLimit.resetSeconds !== null) {
          rateLimit.resetSeconds = result.rateLimit.resetSeconds;
        }
        if (!result.candidate) {
          await saveBraveNoResult(product.id);
          unresolved += 1;
          continue;
        }
        let image: ValidatedProductImage;
        try {
          image = await fetchBraveCandidateImage(result.candidate.sourceImageUrl);
        } catch {
          await saveBraveNoResult(product.id);
          unresolved += 1;
          continue;
        }
        await saveCandidate({
          productId: product.id,
          candidate: result.candidate,
          status: "PENDING",
          evidence: braveReviewEvidence(),
          image: image.metadata,
        });
        queued += 1;
      } catch (error) {
        failed += 1;
        await saveBraveRetry(product.id);
        if (error instanceof BraveImageSearchRequestError && error.status === 429) {
          rateLimited = true;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BRAVE_CONCURRENCY, products.length) }, () => worker()),
  );
  return {
    selected: products.length,
    queried,
    queued,
    unresolved,
    failed,
    eligibleRemaining: (await readBraveImageSearchEligibleProducts()).length,
    rateLimit,
  };
}

export async function runBraveImageSearch(limit: number): Promise<BraveImageSearchRunResult> {
  if (runningBraveImageSearch) {
    throw new ProductImageJobAlreadyRunningError("A Brave image search is already running.");
  }
  runningBraveImageSearch = executeBraveImageSearch(limit);
  try {
    return await runningBraveImageSearch;
  } finally {
    runningBraveImageSearch = null;
  }
}

export async function readProductImageReviewQueue(input: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  query?: string;
  cursor?: string;
  pageSize?: number;
}) {
  const pageSize = Math.min(50, Math.max(1, Math.trunc(input.pageSize ?? 20)));
  const status = input.status ?? "PENDING";
  const cursorRecord = input.cursor
    ? await prisma.productImageCandidate.findUnique({
      where: { id: input.cursor },
      select: { createdAt: true, id: true },
    })
    : null;
  const query = input.query?.trim().slice(0, 100);
  const where: Prisma.ProductImageCandidateWhereInput = {
    status,
    ...(query ? {
      product: {
        OR: [
          { itemName: { contains: query, mode: "insensitive" } },
          { brandName: { contains: query, mode: "insensitive" } },
          { barcode: { contains: query, mode: "insensitive" } },
        ],
      },
    } : {}),
    ...(cursorRecord ? {
      OR: [
        { createdAt: { lt: cursorRecord.createdAt } },
        { createdAt: cursorRecord.createdAt, id: { lt: cursorRecord.id } },
      ],
    } : {}),
  };
  const [items, grouped, validatedReviewCount] = await Promise.all([
    prisma.productImageCandidate.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            itemName: true,
            brandName: true,
            barcode: true,
            packLabel: true,
            manufacturer: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: status === "PENDING" ? (pageSize + 1) * 3 : pageSize + 1,
    }),
    prisma.product.groupBy({
      by: ["imageResolutionStatus"],
      _count: { _all: true },
    }),
    prisma.product.count({
      where: {
        imageResolutionStatus: ProductImageResolutionStatus.REVIEW,
        imageCandidates: {
          some: {
            status: ProductImageCandidateStatus.PENDING,
            OR: [
              { provider: { not: BRAVE_IMAGE_SEARCH_PROVIDER } },
              {
                imageMimeType: { not: null },
                imageWidth: { not: null },
                imageHeight: { not: null },
              },
            ],
          },
        },
      },
    }),
  ]);
  const visibleItems = status === "PENDING"
    ? items.filter(candidateHasValidatedPreview)
    : items;
  const page = visibleItems.slice(0, pageSize);
  const counts = Object.fromEntries(grouped.map((entry) => [
    entry.imageResolutionStatus,
    entry._count._all,
  ]));
  return {
    summary: {
      verified: counts.VERIFIED ?? 0,
      review: validatedReviewCount,
      unresolved: counts.UNRESOLVED ?? 0,
      pending: counts.PENDING ?? 0,
    },
    items: page.map((item) => ({
      id: item.id,
      status: item.status,
      provider: item.provider,
      sourcePageUrl: item.sourcePageUrl,
      sourceLicence: item.sourceLicence,
      sourceProductName: item.sourceProductName,
      sourceBrand: item.sourceBrand,
      sourceManufacturer: item.sourceManufacturer,
      sourceMarket: item.sourceMarket,
      evidence: item.evidence,
      score: item.score,
      autoPublishEligible: item.autoPublishEligible,
      imageMimeType: item.imageMimeType,
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      imageByteSize: item.imageByteSize,
      rejectionReason: item.rejectionReason,
      previewUrl: `/api/product-image-candidates/${encodeURIComponent(item.id)}/preview`,
      product: {
        id: item.product.id,
        itemName: item.product.itemName,
        brandName: item.product.brandName,
        barcode: item.product.barcode,
        packLabel: item.product.packLabel,
        manufacturerName: item.product.manufacturer.name,
        currentImageUrl: productImageUrl(item.product.id),
      },
    })),
    nextCursor: visibleItems.length > pageSize ? page.at(-1)?.id ?? null : null,
  };
}

async function candidateById(candidateId: string) {
  const candidate = await prisma.productImageCandidate.findUnique({
    where: { id: candidateId },
    include: { product: { select: { id: true } } },
  });
  if (!candidate) throw new ProductImageCandidateNotFoundError("Product image candidate was not found.");
  return candidate;
}

async function candidateForDecision(candidateId: string) {
  const candidate = await candidateById(candidateId);
  if (candidate.status !== ProductImageCandidateStatus.PENDING) {
    throw new ProductImageCandidateStateError("Product image candidate has already been reviewed.");
  }
  return candidate;
}

function candidateSource(candidate: Awaited<ReturnType<typeof candidateForDecision>>): ProductImageProviderCandidate {
  return {
    provider: candidate.provider,
    sourcePageUrl: candidate.sourcePageUrl,
    sourceImageUrl: candidate.sourceImageUrl,
    sourceLicence: candidate.sourceLicence,
    matchMethod: candidate.matchMethod as ProductImageProviderCandidate["matchMethod"],
    sourceIdentifierType: candidate.sourceIdentifierType,
    sourceIdentifierValue: candidate.sourceIdentifierValue,
    sourceProductName: candidate.sourceProductName,
    sourceBrand: candidate.sourceBrand,
    sourceManufacturer: candidate.sourceManufacturer,
    sourceMarket: candidate.sourceMarket,
    sourcePackCount: null,
  };
}

export async function approveProductImageCandidate(candidateId: string, reviewerId: string): Promise<void> {
  const candidate = await candidateForDecision(candidateId);
  const image = candidate.provider === BRAVE_IMAGE_SEARCH_PROVIDER
    ? await fetchBraveCandidateImage(candidate.sourceImageUrl)
    : await fetchValidatedProductImage(candidate.sourceImageUrl, {
      allowedHosts: allowedImageHostsForProvider(candidate.provider),
    });
  await activateCandidate({
    productId: candidate.product.id,
    candidateId: candidate.id,
    candidate: candidateSource(candidate),
    image,
    reviewedBy: reviewerId,
  });
}

export async function rejectProductImageCandidate(input: {
  candidateId: string;
  reviewerId: string;
  reason: string;
  leaveUnresolved?: boolean;
}): Promise<void> {
  const candidate = await candidateForDecision(input.candidateId);
  const reason = boundedReason(input.reason);
  if (!reason) throw new Error("A rejection reason is required.");
  const reviewedAt = new Date();
  await prisma.$transaction(async (tx) => {
    if (input.leaveUnresolved) {
      await tx.productImageCandidate.updateMany({
        where: {
          productId: candidate.productId,
          status: ProductImageCandidateStatus.PENDING,
        },
        data: {
          status: ProductImageCandidateStatus.REJECTED,
          rejectionReason: reason,
          reviewedBy: input.reviewerId,
          reviewedAt,
        },
      });
      await tx.product.update({
        where: { id: candidate.productId },
        data: {
          imageResolutionStatus: ProductImageResolutionStatus.UNRESOLVED,
          imageCheckedAt: reviewedAt,
          imageRetryAt: new Date(Date.now() + UNRESOLVED_RECHECK_MS),
          imageResolutionError: reason,
          imageUrl: productImageUrl(candidate.productId),
        },
      });
      return;
    }
    await tx.productImageCandidate.update({
      where: { id: candidate.id },
      data: {
        status: ProductImageCandidateStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: input.reviewerId,
        reviewedAt,
      },
    });
    const remaining = await tx.productImageCandidate.count({
      where: {
        productId: candidate.productId,
        status: ProductImageCandidateStatus.PENDING,
      },
    });
    await tx.product.update({
      where: { id: candidate.productId },
      data: {
        imageResolutionStatus: remaining > 0
          ? ProductImageResolutionStatus.REVIEW
          : ProductImageResolutionStatus.UNRESOLVED,
        imageCheckedAt: reviewedAt,
        imageRetryAt: remaining > 0 ? null : new Date(Date.now() + UNRESOLVED_RECHECK_MS),
        imageResolutionError: remaining > 0 ? null : reason,
        imageUrl: productImageUrl(candidate.productId),
      },
    });
  });
}

export async function readProductImageAsset(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      brandName: true,
      updatedAt: true,
      imageResolutionStatus: true,
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

export async function readCandidatePreview(candidateId: string): Promise<ValidatedProductImage> {
  const candidate = await candidateById(candidateId);
  if (candidate.provider === BRAVE_IMAGE_SEARCH_PROVIDER) {
    return fetchBraveCandidateImage(candidate.sourceImageUrl);
  }
  return fetchValidatedProductImage(candidate.sourceImageUrl, {
    allowedHosts: allowedImageHostsForProvider(candidate.provider),
  });
}

export async function readProductImageStatusCounts() {
  const grouped = await prisma.product.groupBy({
    by: ["imageResolutionStatus"],
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((entry) => [entry.imageResolutionStatus, entry._count._all]));
}
