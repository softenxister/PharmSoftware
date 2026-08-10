import { Send, X } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { PurchaseCorrectionDialogModel } from "./workflow/usePurchaseWorkflow";
import styles from "./PurchaseEntry.module.css";

export function PurchaseCorrectionDialog({ model }: { model: PurchaseCorrectionDialogModel }) {
  const { open, reason, error, isSubmitting, changeReason, close, submit } = model;
  const { t } = usePreferences();
  if (!open) return null;
  return (
    <div className={styles.purchaseConfirmBackdrop} role="presentation" onMouseDown={close}>
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
          <button type="button" className={styles.correctionCloseButton} onClick={close} aria-label={t("purchaseEntry.closeRequest")}>
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
            onChange={event => changeReason(event.target.value)}
          />
          <small>{t("purchaseEntry.reasonCount", { count: reason.trim().length })}</small>
        </label>
        {error && <p className={styles.purchaseConfirmError} role="alert">{error}</p>}
        <div className={styles.purchaseConfirmActions}>
          <button type="button" className={styles.secondaryWindowButton} onClick={close} disabled={isSubmitting}>
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={styles.primaryWindowButton}
            onClick={() => void submit()}
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
