"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import { invalidateStockCatalog } from "@/app/stock/stockCatalogClient";
import { ProductImageCandidateDetail } from "./ProductImageCandidateDetail";
import {
  braveImageSearchRunLimit,
  canRunBraveImageSearch,
  directProductImageRejection,
  PRODUCT_IMAGE_REVIEW_PAGE_SIZE,
  reviewQueuePageRequest,
  type BraveImageSearchEligibility,
  type BraveImageSearchRunResult,
  type ProductImageCandidateStatus,
  type ProductImageReviewData,
  type ProductImageReviewItem,
} from "./productImageReview";
import styles from "./Settings.module.css";

const EMPTY_DATA: ProductImageReviewData = {
  summary: { verified: 0, review: 0, unresolved: 0, pending: 0 },
  items: [],
  nextCursor: null,
};

const EMPTY_BRAVE_ELIGIBILITY: BraveImageSearchEligibility = {
  configured: false,
  eligibleCount: 0,
  maxPerRun: 1_000,
};

const STATUS_TABS = [
  ["PENDING", "productImages.statusPending"],
  ["APPROVED", "productImages.statusApproved"],
  ["REJECTED", "productImages.statusRejected"],
] as const;

async function responseJson(response: Response) {
  return response.json() as Promise<{ data?: ProductImageReviewData; error?: string }>;
}

async function braveResponseJson<T>(response: Response) {
  return response.json() as Promise<{ data?: T; error?: string }>;
}

export function ProductImageReviewPanel() {
  const { t, formatNumber } = usePreferences();
  const [data, setData] = useState(EMPTY_DATA);
  const [status, setStatus] = useState<ProductImageCandidateStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [loading, setLoading] = useState(true);
  const [braveLoading, setBraveLoading] = useState(true);
  const [braveEligibility, setBraveEligibility] = useState(EMPTY_BRAVE_ELIGIBILITY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (cursor?: string, targetPageIndex = 0) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status,
        pageSize: String(PRODUCT_IMAGE_REVIEW_PAGE_SIZE),
      });
      if (query) params.set("query", query);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/product-image-review?${params}`, { cache: "no-store" });
      const payload = await responseJson(response);
      if (!response.ok || !payload.data) throw new Error(payload.error || t("productImages.loadError"));
      setData(payload.data);
      setPageIndex(targetPageIndex);
      setPageCursors((current) => {
        const cursors = current.slice(0, targetPageIndex + 1);
        cursors[targetPageIndex] = cursor ?? null;
        if (payload.data!.nextCursor) cursors[targetPageIndex + 1] = payload.data!.nextCursor;
        return cursors;
      });
      setSelectedId(payload.data.items[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("productImages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [query, status, t]);

  const loadBraveEligibility = useCallback(async () => {
    setBraveLoading(true);
    try {
      const response = await fetch("/api/product-image-jobs/brave", { cache: "no-store" });
      const payload = await braveResponseJson<BraveImageSearchEligibility>(response);
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || t("productImages.braveEligibilityError"));
      }
      setBraveEligibility(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : t("productImages.braveEligibilityError"));
    } finally {
      setBraveLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    void loadBraveEligibility();
  }, [load, loadBraveEligibility]);

  const selected = useMemo(
    () => data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId],
  );

  const searchQueue = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = search.trim();
    setPageIndex(0);
    setPageCursors([null]);
    if (nextQuery === query) {
      void load();
    } else {
      setQuery(nextQuery);
    }
  };

  const changeQueuePage = (direction: "previous" | "next") => {
    if (loading) return;
    const request = reviewQueuePageRequest(direction, pageIndex, pageCursors, data.nextCursor);
    if (!request) return;
    void load(request.cursor, request.pageIndex);
  };

  const decide = async (
    candidate: ProductImageReviewItem,
    action: "approve" | "reject",
    body?: { reason: string; leaveUnresolved: boolean },
  ) => {
    if (busy || candidate.status !== "PENDING") return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/product-image-review/${encodeURIComponent(candidate.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("productImages.actionError"));
      if (action === "approve") invalidateStockCatalog();
      await load(pageCursors[pageIndex] ?? undefined, pageIndex);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("productImages.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const runBraveSearch = async () => {
    if (!canRunBraveImageSearch(braveEligibility, busy)) return;
    const limit = braveImageSearchRunLimit(braveEligibility.eligibleCount);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/product-image-jobs/brave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const payload = await braveResponseJson<BraveImageSearchRunResult>(response);
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || t("productImages.braveRunError"));
      }
      setNotice(t("productImages.braveRunSummary", {
        queried: payload.data.queried,
        queued: payload.data.queued,
        unresolved: payload.data.unresolved,
        failed: payload.data.failed,
      }));
      await Promise.all([load(), loadBraveEligibility()]);
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : t("productImages.braveRunError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${styles.panel} ${styles.imageReviewPanel}`}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>{t("settings.productImages")}</h2><p className={styles.panelDescription}>{t("productImages.description")}</p></div>
        <div className={styles.braveImageAction}>
          <span aria-live="polite">
            {braveLoading
              ? t("productImages.braveChecking")
              : t("productImages.braveEligible", { count: braveEligibility.eligibleCount })}
          </span>
          <small>
            {braveEligibility.configured
              ? t("productImages.braveOrderHint")
              : t("productImages.braveNotConfigured")}
          </small>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={runBraveSearch}
            disabled={braveLoading || !canRunBraveImageSearch(braveEligibility, busy)}
          >
            <RefreshCw size={15} className={busy ? styles.spinningIcon : undefined} />
            {busy ? t("productImages.braveRunning") : t("productImages.braveRun")}
          </button>
        </div>
      </div>
      <div className={styles.imageReviewBody}>
        <div className={styles.ownerOnlyNotice}><ShieldCheck size={16} /><span><strong>{t("productImages.ownerOnly")}</strong> {t("productImages.ownerOnlyHint")}</span></div>

        <div className={styles.imageSummary} aria-label={t("productImages.summary")}>
          {([
            ["verified", data.summary.verified],
            ["review", data.summary.review],
            ["unresolved", data.summary.unresolved],
            ["pending", data.summary.pending],
          ] as const).map(([key, count]) => (
            <div key={key}><span>{t(`productImages.${key}`)}</span><strong>{formatNumber(count)}</strong></div>
          ))}
        </div>

        <div className={styles.imageReviewToolbar}>
          <form onSubmit={searchQueue}>
            <label className={styles.searchControl}>
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("productImages.search")} aria-label={t("productImages.search")} />
            </label>
          </form>
          <div className={styles.imageStatusTabs} aria-label={t("productImages.filterStatus")}>
            {STATUS_TABS.map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  if (status === value) return;
                  setPageIndex(0);
                  setPageCursors([null]);
                  setStatus(value);
                }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className={styles.formError} role="alert">{error}</div>}
        {notice && <div className={styles.imageReviewNotice} role="status">{notice}</div>}

        <div className={styles.imageReviewWorkspace}>
          <aside className={styles.imageCandidateQueue} aria-label={t("productImages.queue")}>
            <div className={styles.imageCandidateQueueHeader}><strong>{t("productImages.queue")}</strong><span>{formatNumber(data.items.length)}</span></div>
            {loading && data.items.length === 0 ? <div className={styles.imageQueueState}>{t("productImages.loading")}</div> : data.items.length === 0 ? (
              <div className={styles.imageQueueState}><Images size={24} /><strong>{t("productImages.empty")}</strong><span>{t("productImages.emptyHint")}</span></div>
            ) : data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selected?.id === item.id ? styles.imageCandidateActive : undefined}
                aria-current={selected?.id === item.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span><strong>{item.product.itemName}</strong><small>{item.product.brandName} · {item.product.barcode}</small></span>
                <span>{item.score}</span>
              </button>
            ))}
            {(data.items.length > 0 || pageIndex > 0) && (
              <div className={styles.imageQueuePagination} aria-label={t("productImages.pagination")}>
                <button
                  type="button"
                  aria-label={t("productImages.previousPage")}
                  title={t("productImages.previousPage")}
                  onClick={() => changeQueuePage("previous")}
                  disabled={loading || pageIndex === 0}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <strong>{t("productImages.page", { page: pageIndex + 1 })}</strong>
                <button
                  type="button"
                  aria-label={t("productImages.nextPage")}
                  title={t("productImages.nextPage")}
                  onClick={() => changeQueuePage("next")}
                  disabled={loading || !data.nextCursor}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </aside>
          <ProductImageCandidateDetail
            key={selected?.id ?? "empty"}
            candidate={selected}
            busy={busy}
            onApprove={(item) => void decide(item, "approve")}
            onReject={(item) => void decide(item, "reject", directProductImageRejection())}
            onLeaveUnresolved={(item, reason) => void decide(item, "reject", { reason, leaveUnresolved: true })}
          />
        </div>
      </div>
    </section>
  );
}
