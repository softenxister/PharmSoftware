export type ProductImageCandidateStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProductImageReviewItem = {
  id: string;
  status: ProductImageCandidateStatus;
  provider: string;
  sourcePageUrl: string;
  sourceLicence: string;
  sourceProductName: string | null;
  sourceBrand: string | null;
  sourceManufacturer: string | null;
  sourceMarket: string | null;
  evidence: unknown;
  score: number;
  autoPublishEligible: boolean;
  imageMimeType: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageByteSize: number | null;
  rejectionReason: string | null;
  previewUrl: string;
  product: {
    id: string;
    itemName: string;
    brandName: string;
    barcode: string;
    packLabel: string;
    manufacturerName: string;
    currentImageUrl: string;
  };
};

export type ProductImageReviewData = {
  summary: {
    verified: number;
    review: number;
    unresolved: number;
    pending: number;
  };
  items: ProductImageReviewItem[];
  nextCursor: string | null;
};

export const PRODUCT_IMAGE_REVIEW_PAGE_SIZE = 8;

export function directProductImageRejection(): {
  reason: string;
  leaveUnresolved: false;
} {
  return {
    reason: "Rejected during product image review.",
    leaveUnresolved: false,
  };
}

export function reviewQueuePageRequest(
  direction: "previous" | "next",
  pageIndex: number,
  pageCursors: readonly (string | null | undefined)[],
  nextCursor: string | null,
): { pageIndex: number; cursor?: string } | null {
  if (direction === "previous") {
    if (pageIndex <= 0) return null;
    return {
      pageIndex: pageIndex - 1,
      cursor: pageCursors[pageIndex - 1] ?? undefined,
    };
  }
  if (!nextCursor) return null;
  return { pageIndex: pageIndex + 1, cursor: nextCursor };
}

export type BraveImageSearchEligibility = {
  configured: boolean;
  eligibleCount: number;
  maxPerRun: number;
};

export type BraveImageSearchRunResult = {
  selected: number;
  queried: number;
  queued: number;
  unresolved: number;
  failed: number;
  eligibleRemaining: number;
  rateLimit: {
    remaining: number | null;
    resetSeconds: number | null;
  };
};

export function braveImageSearchRunLimit(eligibleCount: number): number {
  if (!Number.isFinite(eligibleCount) || eligibleCount <= 0) return 0;
  return Math.min(1_000, Math.trunc(eligibleCount));
}

export function canRunBraveImageSearch(
  eligibility: Pick<BraveImageSearchEligibility, "configured" | "eligibleCount">,
  busy: boolean,
): boolean {
  return eligibility.configured && braveImageSearchRunLimit(eligibility.eligibleCount) > 0 && !busy;
}

export type ProductImageEvidenceRow = {
  kind: "agreement" | "missing" | "conflict";
  field: string;
};

export function evidenceRows(value: unknown): ProductImageEvidenceRow[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const evidence = value as Record<string, unknown>;
  const rows: ProductImageEvidenceRow[] = [];
  for (const [key, kind] of [
    ["agreements", "agreement"],
    ["missing", "missing"],
    ["conflicts", "conflict"],
  ] as const) {
    const fields = evidence[key];
    if (!Array.isArray(fields)) continue;
    for (const field of fields.slice(0, 20)) {
      if (typeof field === "string" && field.trim()) {
        rows.push({ kind, field: field.replace(/\s+/g, " ").trim().slice(0, 80) });
      }
    }
  }
  return rows;
}

export function formatImageBytes(value: number | null): string {
  if (!Number.isFinite(value) || Number(value) < 0) return "—";
  if (Number(value) < 1024) return `${value} B`;
  if (Number(value) < 1024 * 1024) return `${(Number(value) / 1024).toFixed(1)} KB`;
  return `${(Number(value) / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasReviewDecision(
  candidate: Pick<ProductImageReviewItem, "status"> | null,
  busy: boolean,
): boolean {
  return candidate?.status === "PENDING" && !busy;
}
