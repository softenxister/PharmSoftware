import type { StorePaymentMethod } from '@/config/preferences/storePosSettings';
import styles from '../NewSale.module.css';
import { formatBaht, resolvePaidSaleNextStep } from './saleDraft';
import { IconPrint, IconTick } from './SalePrimitives';
import type { SaleCompletionDialogModel } from './useSaleWorkflow';

export function SaleCompletionDialog({ model }: { model: SaleCompletionDialogModel }) {
  const {
    t,
    invoiceCreated,
    paymentMethodLabel,
    formatDate,
    paperSize,
    startNewSale,
    newSaleButtonRef,
    hardwareError,
    hardwarePending,
  } = model;

  if (!invoiceCreated) return null;

  return (
    <div className={styles.invoiceCreatedBackdrop}>
      <div className={styles.invoiceCreatedCard} role="status" aria-live="polite">
        <div className={styles.invoiceCreatedIcon}><IconTick /></div>
        <h2 className={styles.invoiceCreatedTitle}>{t('newSale.invoiceCreated')}</h2>
        <p className={styles.invoiceCreatedSub}>{t('newSale.paymentReceived')}</p>
        {hardwareError && <p className={styles.drawerError} role="alert">{hardwareError}</p>}
        {hardwarePending && <p role="status">Sending drawer command… Check QZ Tray for an approval prompt.</p>}

        <div className={styles.invoiceCreatedDetails}>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('newSale.invoiceNo')}</span>
            <strong className={styles.invoiceCreatedNo}>{invoiceCreated.invoiceNo}</strong>
          </div>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('newSale.amountPaid')}</span>
            <strong>฿{formatBaht(invoiceCreated.amountPaid)}</strong>
          </div>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('sales.netTotal')}</span>
            <strong>฿{formatBaht(invoiceCreated.netTotal)}</strong>
          </div>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('newSale.change')}</span>
            <strong>฿{formatBaht(invoiceCreated.changeDue)}</strong>
          </div>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('newSale.method')}</span>
            <strong>{paymentMethodLabel(invoiceCreated.paymentMode as StorePaymentMethod)}</strong>
          </div>
          <div className={styles.invoiceCreatedRow}>
            <span>{t('newSale.time')}</span>
            <strong className={styles.invoiceCreatedTime}>
              {formatDate(invoiceCreated.createdAt, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className={styles.printReceiptBtn}
          disabled={hardwarePending}
          onClick={() => {
            const nextStep = resolvePaidSaleNextStep('print', invoiceCreated.saleId);
            if (nextStep.kind === 'receipt-route') {
              window.open(`${nextStep.path}?paper=${paperSize}`, '_blank', 'noopener,noreferrer');
              if (nextStep.resetOriginalSale) startNewSale();
            }
          }}
        >
          <IconPrint />
          {t('newSale.printReceipt')}
        </button>
        <button ref={newSaleButtonRef} type="button" className={styles.newSaleBtn} onClick={startNewSale} disabled={hardwarePending}>
          <span className={styles.newSaleBtnIcon} aria-hidden="true">+</span>
          <span>{t('newSale.new')}</span>
        </button>
      </div>
    </div>
  );
}
