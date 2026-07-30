import styles from '../NewSale.module.css';
import { formatBaht } from './saleDraft';
import { IconClose } from './SalePrimitives';
import type { SaleWorkflow } from './useSaleWorkflow';

export function SalePaymentPanel({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    discountOpen,
    setDiscountOpen,
    subtotal,
    itemDiscountAmount,
    discountAmount,
    discountType,
    setDiscountType,
    discountInput,
    setDiscountInput,
    draftNetPayable,
    customerPayInputRef,
    customerPayInput,
    setCustomerPayInput,
    setCustomerPayEdited,
    setSaleSubmitError,
    handleCustomerPayEnter,
    paymentMethod,
    addCustomerCash,
    liveChangeDue,
    autoOpenCashDrawer,
    cashDrawerDevice,
    saleSubmitError,
    appliedDiscount,
    clearDiscount,
    submitInvoicePayment,
    saleSubmitting,
  } = sale;

  if (!discountOpen) return null;

  return (
    <div className={styles.drawerBackdrop} onClick={() => setDiscountOpen(false)}>
      <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{t('newSale.invoiceBreakdown')}</h2>
          <button type="button" className={styles.drawerClose} onClick={() => setDiscountOpen(false)} aria-label={t('newSale.close')}>
            <IconClose />
          </button>
        </div>

        <div className={styles.drawerRow}>
          <span className={styles.muted}>{t('newSale.subtotal')}</span>
          <span>฿{formatBaht(subtotal)}</span>
        </div>
        <div className={styles.drawerRow}>
          <span className={styles.muted}>{t('newSale.itemDiscount')}</span>
          <span>฿{formatBaht(itemDiscountAmount)}</span>
        </div>
        <div className={styles.drawerRow}>
          <span className={styles.muted}>{t('newSale.currentDiscount')}</span>
          <span>฿{formatBaht(discountAmount)}</span>
        </div>

        <p className={styles.drawerSectionLabel}>{t('newSale.billDiscount')}</p>
        <div className={styles.discountTypeToggle}>
          <button type="button" className={`${styles.discountTypeBtn} ${discountType === 'percent' ? styles.discountTypeBtnActive : ''}`} onClick={() => setDiscountType('percent')}>%</button>
          <button type="button" className={`${styles.discountTypeBtn} ${discountType === 'thb' ? styles.discountTypeBtnActive : ''}`} onClick={() => setDiscountType('thb')}>฿</button>
        </div>
        <input
          type="number"
          min={0}
          value={discountInput}
          onChange={(event) => setDiscountInput(event.target.value)}
          placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
          className={styles.discountInput}
        />

        <div className={styles.drawerRow}>
          <span className={styles.muted}>{t('sales.netTotal')}</span>
          <span className={styles.drawerNetPayable}>฿{formatBaht(draftNetPayable)}</span>
        </div>

        <p className={styles.drawerSectionLabel}>{t('newSale.customerPay')}</p>
        <input
          ref={customerPayInputRef}
          type="number"
          min={0}
          value={customerPayInput}
          onChange={(event) => {
            setSaleSubmitError('');
            setCustomerPayEdited(true);
            setCustomerPayInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleCustomerPayEnter();
            }
          }}
          placeholder={t('newSale.keyPaid')}
          className={styles.customerPayInput}
        />

        {paymentMethod === 'Cash' && (
          <div className={styles.cashNoteRow} aria-label={t('newSale.quickCash')}>
            {[
              { amount: 100, className: styles.cashNote100 },
              { amount: 500, className: styles.cashNote500 },
              { amount: 1000, className: styles.cashNote1000 },
            ].map(({ amount, className }) => (
              <button
                key={amount}
                type="button"
                className={`${styles.cashNoteButton} ${className}`}
                onClick={() => addCustomerCash(amount)}
                aria-label={t('newSale.addBaht', { amount })}
              >
                <span className={styles.cashNoteGraphic} aria-hidden="true">
                  <span className={styles.cashNoteSeal}>฿</span>
                  <span className={styles.cashNoteLines}><span /><span /><span /></span>
                </span>
                <strong>{amount}</strong>
              </button>
            ))}
          </div>
        )}

        <div className={styles.changePanel}>
          <span className={styles.muted}>{t('newSale.change')}</span>
          <strong>฿{formatBaht(liveChangeDue)}</strong>
        </div>
        <div className={styles.cashDrawerStatus}>
          <span className={styles.cashDrawerDot} />
          <span>{autoOpenCashDrawer ? `Cash drawer auto open: ${cashDrawerDevice}` : 'Cash drawer auto open: off'}</span>
        </div>
        {saleSubmitError && <div className={styles.drawerError} role="alert">{saleSubmitError}</div>}

        <div className={styles.drawerActions}>
          {appliedDiscount && (
            <button type="button" className={styles.drawerSecondaryBtn} onClick={clearDiscount}>
              {t('newSale.removeDiscount')}
            </button>
          )}
          <button
            type="button"
            className={`${styles.drawerPrimaryBtn} ${styles.submitActionButton}`}
            onClick={() => void submitInvoicePayment()}
            disabled={saleSubmitting}
          >
            {saleSubmitting ? t('newSale.submitting') : t('newSale.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
