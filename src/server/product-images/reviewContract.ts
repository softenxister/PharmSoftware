const CANDIDATE_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

export type ProductImageReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export function parseProductImageReviewQuery(url: URL): {
  status: ProductImageReviewStatus;
  query?: string;
  cursor?: string;
  pageSize: number;
} {
  const requestedStatus = url.searchParams.get("status")?.toUpperCase() ?? "";
  const status = CANDIDATE_STATUSES.has(requestedStatus)
    ? requestedStatus as ProductImageReviewStatus
    : "PENDING";
  const query = url.searchParams.get("query")?.trim().slice(0, 100);
  const rawCursor = url.searchParams.get("cursor")?.trim();
  const cursor = rawCursor && /^[a-zA-Z0-9_-]{1,200}$/.test(rawCursor) ? rawCursor : undefined;
  const requestedPageSize = Number(url.searchParams.get("pageSize") ?? 20);
  const pageSize = Number.isInteger(requestedPageSize)
    ? Math.min(50, Math.max(1, requestedPageSize))
    : 20;
  return {
    status,
    ...(query ? { query } : {}),
    ...(cursor ? { cursor } : {}),
    pageSize,
  };
}

export function parseProductImageDecisionInput(value: unknown): {
  reason: string;
  leaveUnresolved: boolean;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim() : "";
  if (!reason || reason.length > 500) return null;
  if (input.leaveUnresolved !== undefined && typeof input.leaveUnresolved !== "boolean") return null;
  return { reason, leaveUnresolved: input.leaveUnresolved === true };
}

export function parseProductImageBatchInput(value: unknown): { batchSize: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const batchSize = (value as Record<string, unknown>).batchSize;
  return Number.isInteger(batchSize) && Number(batchSize) >= 1 && Number(batchSize) <= 50
    ? { batchSize: Number(batchSize) }
    : null;
}
