"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import styles from "./PurchaseEntry.module.css";

type WorkflowStatus = "draft" | "partial" | "received" | null;

type PurchaseWorkflowBarProps = {
  status: WorkflowStatus;
  itemCount: number;
  totalQty: number;
  netTotal: number;
  canContinue: boolean;
  isBusy: boolean;
  reviewConfirmed: boolean;
  canManageStock: boolean;
  hasPendingCorrection: boolean;
  onReviewConfirmedChange: (checked: boolean) => void;
  onPrepare: () => void;
  onBackToEdit: () => void;
  onComplete: () => void;
  onRequestCorrection: () => void;
  onAdjustStock: () => void;
};

const money = (value: number) => value.toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PurchaseWorkflowBar({
  status,
  itemCount,
  totalQty,
  netTotal,
  canContinue,
  isBusy,
  reviewConfirmed,
  canManageStock,
  hasPendingCorrection,
  onReviewConfirmedChange,
  onPrepare,
  onBackToEdit,
  onComplete,
  onRequestCorrection,
  onAdjustStock,
}: PurchaseWorkflowBarProps) {
  return (
    <div className={styles.purchaseSummaryBar} aria-label="Purchase workflow and summary">
      <div className={styles.purchaseSummaryStat}>
        <span className={styles.purchaseSummaryLabel}>Items</span>
        <span className={styles.purchaseSummaryValue}>{itemCount}</span>
      </div>
      <div className={styles.purchaseSummaryDivider} />
      <div className={styles.purchaseSummaryStat}>
        <span className={styles.purchaseSummaryLabel}>Quantity</span>
        <span className={styles.purchaseSummaryValue}>{totalQty}</span>
      </div>
      <div className={styles.purchaseSummaryDivider} />
      <div className={styles.purchaseTotalStat}>
        <span className={styles.purchaseSummaryLabel}>Net total</span>
        <span className={styles.purchaseNetValue}>฿{money(netTotal)}</span>
      </div>

      {(status === null || status === "draft") && (
        <div className={styles.workflowActionGroup}>
          <span className={styles.workflowHint}>Stock will not change</span>
          <button
            type="button"
            className={styles.purchaseNetButton}
            disabled={!canContinue || isBusy}
            onClick={onPrepare}
          >
            <ClipboardCheck size={17} />
            <span>
              <small>Step 1</small>
              Prepare for review
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
              onChange={event => onReviewConfirmedChange(event.target.checked)}
            />
            <span>I checked supplier, quantities, lots and expiry dates</span>
          </label>
          <div className={styles.workflowButtons}>
            <button type="button" className={styles.workflowSecondaryButton} onClick={onBackToEdit} disabled={isBusy}>
              <RotateCcw size={15} />
              Back to edit
            </button>
            <button
              type="button"
              className={styles.workflowCompleteButton}
              onClick={onComplete}
              disabled={!canContinue || !reviewConfirmed || isBusy}
            >
              <CheckCircle2 size={16} />
              Complete &amp; update stock
            </button>
          </div>
        </div>
      )}

      {status === "received" && (
        <div className={styles.workflowCompletedActions}>
          <span className={styles.completedState}>
            <CheckCircle2 size={16} />
            Completed · bill locked
          </span>
          {canManageStock ? (
            <button type="button" className={styles.workflowManagerButton} onClick={onAdjustStock}>
              <ShieldCheck size={16} />
              {hasPendingCorrection ? "Review correction" : "Adjust stock"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.workflowRequestButton}
              onClick={onRequestCorrection}
              disabled={hasPendingCorrection}
            >
              <Send size={15} />
              {hasPendingCorrection ? "Correction pending" : "Request correction"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
