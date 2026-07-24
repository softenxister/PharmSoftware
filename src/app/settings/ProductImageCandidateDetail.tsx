"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, ExternalLink, ImageOff, ShieldAlert, X } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import {
  evidenceRows,
  formatImageBytes,
  hasReviewDecision,
  type ProductImageReviewItem,
} from "./productImageReview";
import styles from "./Settings.module.css";

export function ProductImageCandidateDetail({
  candidate,
  busy,
  onApprove,
  onReject,
}: {
  candidate: ProductImageReviewItem | null;
  busy: boolean;
  onApprove: (candidate: ProductImageReviewItem) => void;
  onReject: (candidate: ProductImageReviewItem, reason: string, leaveUnresolved: boolean) => void;
}) {
  const { t } = usePreferences();
  const [decision, setDecision] = useState<"reject" | "unresolved" | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const evidence = useMemo(() => evidenceRows(candidate?.evidence), [candidate?.evidence]);

  if (!candidate) {
    return (
      <div className={styles.imageReviewEmptyDetail}>
        <ImageOff size={28} aria-hidden="true" />
        <strong>{t("productImages.selectCandidate")}</strong>
        <span>{t("productImages.selectCandidateHint")}</span>
      </div>
    );
  }

  const canDecide = hasReviewDecision(candidate, busy);
  const submitDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision || !canDecide) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "").replace(/\s+/g, " ").trim();
    if (!reason || reason.length > 500) return;
    onReject(candidate, reason, decision === "unresolved");
  };

  return (
    <article className={styles.imageReviewDetail} aria-labelledby="product-image-candidate-title">
      <div className={styles.imageReviewDetailHeader}>
        <div>
          <span className={styles.imageReviewEyebrow}>{t("productImages.candidate")}</span>
          <h3 id="product-image-candidate-title">{candidate.product.itemName}</h3>
          <p>{candidate.product.brandName} · {candidate.product.packLabel}</p>
        </div>
        <span className={`${styles.imageMatchBadge} ${candidate.autoPublishEligible ? styles.imageMatchExact : styles.imageMatchReview}`}>
          {candidate.autoPublishEligible ? <Check size={13} /> : <ShieldAlert size={13} />}
          {candidate.autoPublishEligible ? t("productImages.autoEligible") : t("productImages.manualOnly")}
        </span>
      </div>

      <div className={styles.imageComparison}>
        <figure>
          <div className={styles.imagePreviewFrame}>
            <img src={candidate.product.currentImageUrl} alt="" />
          </div>
          <figcaption>{t("productImages.currentProduct")}</figcaption>
        </figure>
        <figure>
          <div className={styles.imagePreviewFrame}>
            {previewFailed
              ? <span className={styles.imagePreviewUnavailable}><ImageOff size={25} />{t("productImages.noPreview")}</span>
              : <img src={candidate.previewUrl} alt={candidate.sourceProductName || candidate.product.itemName} onError={() => setPreviewFailed(true)} />}
          </div>
          <figcaption>{t("productImages.candidate")}</figcaption>
        </figure>
      </div>

      <div className={styles.imageReviewInfoGrid}>
        <dl className={styles.imageIdentityList}>
          <div><dt>{t("productImages.barcode")}</dt><dd>{candidate.product.barcode}</dd></div>
          <div><dt>{t("productImages.manufacturer")}</dt><dd>{candidate.product.manufacturerName}</dd></div>
          <div><dt>{t("productImages.sourceName")}</dt><dd>{candidate.sourceProductName || "—"}</dd></div>
          <div><dt>{t("productImages.sourceBrand")}</dt><dd>{candidate.sourceBrand || "—"}</dd></div>
          <div><dt>{t("productImages.provider")}</dt><dd>{candidate.provider}</dd></div>
          <div><dt>{t("productImages.licence")}</dt><dd>{candidate.sourceLicence}</dd></div>
          <div><dt>{t("productImages.resolution")}</dt><dd>{candidate.imageWidth && candidate.imageHeight ? `${candidate.imageWidth} × ${candidate.imageHeight}` : "—"}</dd></div>
          <div><dt>{t("productImages.size")}</dt><dd>{formatImageBytes(candidate.imageByteSize)}</dd></div>
        </dl>
        <div className={styles.imageEvidence}>
          <div className={styles.imageEvidenceHeader}>
            <strong>{t("productImages.evidence")}</strong>
            <span>{t("productImages.score", { score: candidate.score })}</span>
          </div>
          {evidence.length === 0
            ? <p className={styles.imageEvidenceEmpty}>{t("productImages.noEvidence")}</p>
            : <ul>{evidence.map((row, index) => (
              <li key={`${row.kind}-${row.field}-${index}`} className={styles[`imageEvidence_${row.kind}`]}>
                <span aria-hidden="true" />
                {t(`productImages.${row.kind}`)}: {row.field}
              </li>
            ))}</ul>}
          <a href={candidate.sourcePageUrl} target="_blank" rel="noreferrer">
            {t("productImages.sourcePage")}<ExternalLink size={13} />
          </a>
        </div>
      </div>

      {candidate.rejectionReason && <div className={styles.imageRejectionNote}>{candidate.rejectionReason}</div>}

      {candidate.status === "PENDING" && (
        <div className={styles.imageReviewActions}>
          {decision ? (
            <form onSubmit={submitDecision} className={styles.imageDecisionForm}>
              <label>
                <span>{t("productImages.reason")}</span>
                <textarea
                  name="reason"
                  rows={2}
                  maxLength={500}
                  required
                  autoFocus
                  placeholder={t("productImages.reasonPlaceholder")}
                  disabled={busy}
                />
              </label>
              <div>
                <button type="button" className={styles.secondaryActionButton} onClick={() => setDecision(null)} disabled={busy}>
                  <X size={14} />{t("productImages.cancel")}
                </button>
                <button type="submit" className={decision === "unresolved" ? styles.unresolvedButton : styles.rejectButton} disabled={!canDecide}>
                  {decision === "unresolved" ? t("productImages.confirmUnresolved") : t("productImages.confirmReject")}
                </button>
              </div>
            </form>
          ) : (
            <>
              <button type="button" className={styles.primaryButton} onClick={() => onApprove(candidate)} disabled={!canDecide}>
                <Check size={15} />{t("productImages.approve")}
              </button>
              <button type="button" className={styles.rejectButton} onClick={() => setDecision("reject")} disabled={!canDecide}>
                {t("productImages.reject")}
              </button>
              <button type="button" className={styles.unresolvedButton} onClick={() => setDecision("unresolved")} disabled={!canDecide}>
                {t("productImages.leaveUnresolved")}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
