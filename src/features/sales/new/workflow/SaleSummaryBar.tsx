import styles from '../NewSale.module.css';
import { formatBaht } from './saleDraft';
import type { SaleSummaryBarModel } from './useSaleWorkflow';

export function SaleSummaryBar({ model }: { model: SaleSummaryBarModel }) {
  const {
    t,
    totalQty,
    uniqueItemCount,
    openInvoiceBreakdown,
    canOpenInvoiceBreakdown,
    appliedDiscount,
    showKeyboardHints,
    netPayable,
  } = model;

  return (
    <div className={styles.summaryBar}>
      <div className={styles.summaryStat}>
        <span className={styles.summaryStatLabel}>{t('newSale.totalQuantity')}</span>
        <span className={styles.summaryStatValue}>{totalQty}</span>
      </div>
      <div className={styles.summaryDivider} />
      <div className={styles.summaryStat}>
        <span className={styles.summaryStatLabel}>{t('newSale.uniqueItems')}</span>
        <span className={styles.summaryStatValue}>{uniqueItemCount}</span>
      </div>
      <div className={styles.summaryDivider} />
      <button
        type="button"
        className={styles.netPayableCell}
        onClick={openInvoiceBreakdown}
        disabled={!canOpenInvoiceBreakdown}
        aria-disabled={!canOpenInvoiceBreakdown}
      >
        <span className={styles.summaryStatLabel}>
          {t('sales.netTotal')} {appliedDiscount && <span className={styles.discountBadge}>{t('newSale.discountApplied')}</span>}
          {showKeyboardHints && <kbd className={styles.netPayableShortcut}>Ctrl + Enter</kbd>}
        </span>
        <span className={styles.netPayableValue}>฿{formatBaht(netPayable)}</span>
      </button>
    </div>
  );
}
