"use client";

import { Send, X } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
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
  const { t } = usePreferences();
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
            <h2 id="purchase-correction-title">{t("purchaseEntry.requestTitle")}</h2>
            <p>{t("purchaseEntry.requestHint")}</p>
          </div>
          <button type="button" className={styles.correctionCloseButton} onClick={onClose} aria-label={t("purchaseEntry.closeRequest")}>
            <X size={16} />
          </button>
        </div>
        <label className={styles.correctionReasonField}>
          <span>{t("purchaseEntry.reason")}</span>
          <textarea
            value={reason}
            maxLength={500}
            autoFocus
            placeholder={t("purchaseEntry.reasonExample")}
            onChange={event => onReasonChange(event.target.value)}
          />
          <small>{t("purchaseEntry.reasonCount", { count: reason.trim().length })}</small>
        </label>
        {error && <p className={styles.purchaseConfirmError} role="alert">{error}</p>}
        <div className={styles.purchaseConfirmActions}>
          <button type="button" className={styles.secondaryWindowButton} onClick={onClose} disabled={isSubmitting}>
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={styles.primaryWindowButton}
            onClick={onSubmit}
            disabled={reason.trim().length < 8 || isSubmitting}
          >
            <Send size={15} />
            {isSubmitting ? t("purchaseEntry.sending") : t("purchaseEntry.sendOwner")}
          </button>
        </div>
      </section>
    </div>
  );
}
