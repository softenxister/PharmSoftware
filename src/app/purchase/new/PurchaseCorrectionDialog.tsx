"use client";

import { Send, X } from "lucide-react";
import styles from "./PurchaseEntry.module.css";

type PurchaseCorrectionDialogProps = {
  reason: string;
  error: string;
  isSubmitting: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function PurchaseCorrectionDialog({
  reason,
  error,
  isSubmitting,
  onReasonChange,
  onClose,
  onSubmit,
}: PurchaseCorrectionDialogProps) {
  return (
    <div className={styles.purchaseConfirmBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.purchaseConfirmWindow}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-correction-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className={styles.correctionDialogHeader}>
          <div>
            <h2 id="purchase-correction-title">Request purchase correction</h2>
            <p>Stock stays unchanged until an owner or admin reviews this request.</p>
          </div>
          <button type="button" className={styles.correctionCloseButton} onClick={onClose} aria-label="Close correction request">
            <X size={16} />
          </button>
        </div>
        <label className={styles.correctionReasonField}>
          <span>Reason for correction</span>
          <textarea
            value={reason}
            maxLength={500}
            autoFocus
            placeholder="Example: Received 12 boxes, but the bill was completed with 10 boxes."
            onChange={event => onReasonChange(event.target.value)}
          />
          <small>{reason.trim().length}/500 · minimum 8 characters</small>
        </label>
        {error && <p className={styles.purchaseConfirmError} role="alert">{error}</p>}
        <div className={styles.purchaseConfirmActions}>
          <button type="button" className={styles.secondaryWindowButton} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryWindowButton}
            onClick={onSubmit}
            disabled={reason.trim().length < 8 || isSubmitting}
          >
            <Send size={15} />
            {isSubmitting ? "Sending..." : "Send to owner/admin"}
          </button>
        </div>
      </section>
    </div>
  );
}
