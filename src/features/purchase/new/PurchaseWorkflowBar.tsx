import {
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { PurchaseWorkflowBarModel } from "./workflow/usePurchaseWorkflow";
import styles from "./PurchaseEntry.module.css";

export function PurchaseWorkflowBar({ model }: { model: PurchaseWorkflowBarModel }) {
  const {
    status,
    itemCount,
    totalQty,
    netTotal,
    canContinue,
    isBusy,
    reviewConfirmed,
    canManageStock,
    hasPendingCorrection,
    changeReviewConfirmation,
    prepare,
    backToEdit,
    complete,
    requestCorrection,
    adjustStock,
  } = model;
  const { t, formatMoney } = usePreferences();
  if (itemCount === 0) return null;
  const summaryStateClass = status === "partial"
    ? styles.purchaseSummaryBarReview
    : status === "received"
      ? styles.purchaseSummaryBarCompleted
      : styles.purchaseSummaryBarDraft;

  return (
    <div className={`${styles.purchaseSummaryBar} ${summaryStateClass}`} aria-label={t("purchaseEntry.summary")}>
      <div className={styles.purchaseSummaryStat}>
        <span className={styles.purchaseSummaryLabel}>{t("purchase.items")}</span>
        <span className={styles.purchaseSummaryValue}>{itemCount}</span>
      </div>
      <div className={styles.purchaseSummaryDivider} />
      <div className={styles.purchaseSummaryStat}>
        <span className={styles.purchaseSummaryLabel}>{t("purchaseEntry.quantity")}</span>
        <span className={styles.purchaseSummaryValue}>{totalQty}</span>
      </div>
      <div className={styles.purchaseSummaryDivider} />
      <div className={styles.purchaseTotalStat}>
        <span className={styles.purchaseSummaryLabel}>{t("purchase.netTotal")}</span>
        <span className={styles.purchaseNetValue}>฿{formatMoney(netTotal)}</span>
      </div>

      {(status === null || status === "draft") && (
        <div className={styles.workflowActionGroup}>
          <span className={styles.workflowHint}>{t("purchaseEntry.stockUnchanged")}</span>
          <button
            type="button"
            className={styles.purchaseNetButton}
            disabled={!canContinue || isBusy}
            onClick={prepare}
          >
            <ClipboardCheck size={17} />
            <span>
              <small>{t("purchaseEntry.stepOne")}</small>
              {t("purchaseEntry.prepare")}
            </span>
          </button>
        </div>
      )}

      {status === "partial" && (
        <div className={styles.workflowReviewActions}>
          <label className={styles.reviewConfirmation}>
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={event => changeReviewConfirmation(event.target.checked)}
            />
            <span>{t("purchaseEntry.checked")}</span>
          </label>
          <div className={styles.workflowButtons}>
            <button type="button" className={styles.workflowSecondaryButton} onClick={backToEdit} disabled={isBusy}>
              <RotateCcw size={15} />
              {t("purchaseEntry.backEdit")}
            </button>
            <button
              type="button"
              className={styles.workflowCompleteButton}
              onClick={complete}
              disabled={!canContinue || !reviewConfirmed || isBusy}
            >
              <CheckCircle2 size={16} />
              {t("purchaseEntry.completeStock")}
            </button>
          </div>
        </div>
      )}

      {status === "received" && (
        <div className={styles.workflowCompletedActions}>
          <span className={styles.completedState}>
            <CheckCircle2 size={16} />
            {t("purchaseEntry.locked")}
          </span>
          {canManageStock ? (
            <button type="button" className={styles.workflowManagerButton} onClick={adjustStock}>
              <ShieldCheck size={16} />
              {hasPendingCorrection ? t("purchaseEntry.reviewCorrection") : t("purchaseEntry.adjustStock")}
            </button>
          ) : (
            <button
              type="button"
              className={styles.workflowRequestButton}
              onClick={requestCorrection}
              disabled={hasPendingCorrection}
            >
              <Send size={15} />
              {hasPendingCorrection ? t("purchaseEntry.correctionPending") : t("purchaseEntry.requestCorrection")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
