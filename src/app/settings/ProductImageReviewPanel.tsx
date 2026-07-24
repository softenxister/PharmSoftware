"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Images, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import { ProductImageCandidateDetail } from "./ProductImageCandidateDetail";
import {
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

const STATUS_TABS = [
  ["PENDING", "productImages.statusPending"],
  ["APPROVED", "productImages.statusApproved"],
  ["REJECTED", "productImages.statusRejected"],
] as const;

async function responseJson(response: Response) {
  return response.json() as Promise<{ data?: ProductImageReviewData; error?: string }>;
}

export function ProductImageReviewPanel() {
  const { t, formatNumber } = usePreferences();
  const [data, setData] = useState(EMPTY_DATA);
  const [status, setStatus] = useState<ProductImageCandidateStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (cursor?: string, append = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, pageSize: "20" });
      if (query) params.set("query", query);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/product-image-review?${params}`, { cache: "no-store" });
      const payload = await responseJson(response);
      if (!response.ok || !payload.data) throw new Error(payload.error || t("productImages.loadError"));
      setData((current) => ({
        ...payload.data!,
        items: append ? [...current.items, ...payload.data!.items] : payload.data!.items,
      }));
      if (!append) setSelectedId(payload.data.items[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("productImages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [query, status, t]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId],
  );

  const searchQueue = (event: FormEvent) => {
    event.preventDefault();
    setQuery(search.trim());
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
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("productImages.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/product-image-jobs/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize: 10 }),
      });
      const payload = await response.json() as { data?: { processed?: number }; error?: string };
      if (!response.ok) throw new Error(payload.error || t("productImages.batchError"));
      setNotice(t("productImages.batchProcessed", { count: payload.data?.processed ?? 0 }));
      await load();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : t("productImages.batchError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${styles.panel} ${styles.imageReviewPanel}`}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>{t("settings.productImages")}</h2><p className={styles.panelDescription}>{t("productImages.description")}</p></div>
        <button type="button" className={styles.primaryButton} onClick={runBatch} disabled={busy}>
          <RefreshCw size={15} className={busy ? styles.spinningIcon : undefined} />
          {busy ? t("productImages.running") : t("productImages.runBatch")}
        </button>
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
              <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
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
            {data.nextCursor && <button type="button" className={styles.imageLoadMore} onClick={() => void load(data.nextCursor ?? undefined, true)} disabled={loading}>{t("productImages.loadMore")}</button>}
          </aside>
          <ProductImageCandidateDetail
            key={selected?.id ?? "empty"}
            candidate={selected}
            busy={busy}
            onApprove={(item) => void decide(item, "approve")}
            onReject={(item, reason, leaveUnresolved) => void decide(item, "reject", { reason, leaveUnresolved })}
          />
        </div>
      </div>
    </section>
  );
}
