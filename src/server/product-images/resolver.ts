import {
  compareProductImageEvidence,
  normalizeGtin,
  type ProductImageEvidenceResult,
  type ProductImageIdentity,
} from "./identity";
import type { ProductImageMetadata } from "./imageMetadata";
import type { ProductImageProvider, ProductImageProviderCandidate } from "./providers/types";

export type ResolvableProduct = {
  id: string;
  itemName: string;
  brandName: string;
  manufacturerName: string;
  market: string;
  barcodes: Array<{ value: string; packageLevel: string }>;
  ingredientNames: string[];
};

export type SavedCandidateInput = {
  productId: string;
  candidate: ProductImageProviderCandidate;
  status: "PENDING" | "REJECTED";
  evidence: ProductImageEvidenceResult;
  image?: ProductImageMetadata;
  rejectionReason?: string;
};

export type ValidatedProductImage = {
  bytes: Uint8Array;
  metadata: ProductImageMetadata;
  sha256: string;
};

export type ProductImageResolverDependencies = {
  provider: ProductImageProvider;
  validateImage: (
    sourceImageUrl: string,
    allowedHosts: readonly string[],
  ) => Promise<ValidatedProductImage>;
  saveCandidate: (input: SavedCandidateInput) => Promise<string>;
  publishCandidate: (input: {
    productId: string;
    candidateId: string;
    candidate: ProductImageProviderCandidate;
    image: ValidatedProductImage;
  }) => Promise<void>;
  markUnresolved: (reason: string) => Promise<void>;
  markRetry: (reason: string) => Promise<void>;
  canPublish: boolean;
};

const DOSAGE_FORMS: Array<[RegExp, string]> = [
  [/\b(?:tablets?|tabs?)\b/i, "tablet"],
  [/\b(?:capsules?|caps?)\b/i, "capsule"],
  [/\b(?:syrup|suspension)\b/i, "syrup"],
  [/\bcream\b/i, "cream"],
  [/\bointment\b/i, "ointment"],
  [/\bgel\b/i, "gel"],
  [/\bdrops?\b/i, "drop"],
  [/\bsprays?\b/i, "spray"],
  [/\b(?:sachets?|powder)\b/i, "sachet"],
  [/\b(?:injection|vials?|ampoules?)\b/i, "injection"],
];

function extractStrength(value: string): string | null {
  return value.match(/\b\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|%)\b/i)?.[0].replace(/\s+/g, "") ?? null;
}

function extractDosageForm(value: string): string | null {
  return DOSAGE_FORMS.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function extractPackCount(value: string): string | null {
  return value.match(/\b(\d{1,5})\s*(?:['’]?s\b|tablets?\b|tabs?\b|capsules?\b|caps?\b|sachets?\b|pieces?\b|pcs?\b)/i)?.[1]
    ?? value.match(/\bx\s*(\d{1,5})\b/i)?.[1]
    ?? null;
}

export function extractProductImageIdentity(product: ResolvableProduct): ProductImageIdentity {
  return {
    productName: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    ingredient: product.ingredientNames.length > 0 ? product.ingredientNames.join(" + ") : null,
    strength: extractStrength(product.itemName),
    dosageForm: extractDosageForm(product.itemName),
    packCount: extractPackCount(product.itemName),
    market: product.market,
  };
}

function candidateIdentity(candidate: ProductImageProviderCandidate): ProductImageIdentity {
  const productName = candidate.sourceProductName ?? "";
  return {
    gtin: candidate.sourceIdentifierType === "GTIN" ? candidate.sourceIdentifierValue : null,
    productName: candidate.sourceProductName,
    brand: candidate.sourceBrand,
    manufacturer: candidate.sourceManufacturer,
    strength: extractStrength(productName),
    dosageForm: extractDosageForm(productName),
    packCount: candidate.sourcePackCount ?? extractPackCount(productName),
    market: candidate.sourceMarket,
  };
}

export async function resolveOneProductImage(
  product: ResolvableProduct,
  dependencies: ProductImageResolverDependencies,
): Promise<
  | { outcome: "VERIFIED"; candidateId: string }
  | { outcome: "REVIEW"; candidateId: string }
  | { outcome: "UNRESOLVED" }
  | { outcome: "PENDING" }
> {
  const identifiers = product.barcodes
    .map(({ value, packageLevel }) => ({ gtin: normalizeGtin(value), packageLevel }))
    .filter((entry): entry is { gtin: string; packageLevel: string } => Boolean(entry.gtin))
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.gtin === entry.gtin) === index);
  if (identifiers.length === 0) {
    await dependencies.markUnresolved("No valid GTIN is available for exact image matching.");
    return { outcome: "UNRESOLVED" };
  }

  for (const identifier of identifiers) {
    let candidate: ProductImageProviderCandidate | null;
    try {
      candidate = await dependencies.provider.findByGtin(identifier.gtin);
    } catch {
      await dependencies.markRetry("The product image provider is temporarily unavailable.");
      return { outcome: "PENDING" };
    }
    if (!candidate) continue;

    const evidence = compareProductImageEvidence({
      product: {
        ...extractProductImageIdentity(product),
        gtin: identifier.gtin,
        packageLevel: identifier.packageLevel,
      },
      candidate: candidateIdentity(candidate),
      sourceLicence: candidate.sourceLicence,
      matchMethod: candidate.matchMethod,
    });
    if (evidence.decision === "REJECT") {
      await dependencies.saveCandidate({
        productId: product.id,
        candidate,
        status: "REJECTED",
        evidence,
        rejectionReason: `Hard identity conflict: ${evidence.conflicts.join(", ")}.`,
      });
      continue;
    }

    let image: ValidatedProductImage;
    try {
      image = await dependencies.validateImage(candidate.sourceImageUrl, dependencies.provider.allowedImageHosts);
    } catch {
      await dependencies.markRetry("The candidate image could not be validated or downloaded.");
      return { outcome: "PENDING" };
    }
    const candidateId = await dependencies.saveCandidate({
      productId: product.id,
      candidate,
      status: "PENDING",
      evidence,
      image: image.metadata,
    });
    if (evidence.autoPublishEligible && dependencies.canPublish) {
      await dependencies.publishCandidate({
        productId: product.id,
        candidateId,
        candidate,
        image,
      });
      return { outcome: "VERIFIED", candidateId };
    }
    return { outcome: "REVIEW", candidateId };
  }

  await dependencies.markUnresolved("No licensed, conflict-free exact-GTIN image was found.");
  return { outcome: "UNRESOLVED" };
}
