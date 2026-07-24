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
