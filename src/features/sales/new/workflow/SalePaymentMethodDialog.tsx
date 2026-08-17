import { useEffect, useRef } from 'react';
import styles from '../NewSale.module.css';
import { IconClose } from './SalePrimitives';
import type { SalePaymentMethodDialogModel } from './useSaleWorkflow';

export function SalePaymentMethodDialog({ model }: { model: SalePaymentMethodDialogModel }) {
  const {
    t,
    open,
    paymentMethods,
    selectedPaymentMethod,
    paymentMethodLabel,
    choosePaymentMethod,
    closePaymentMethodSelection,
    confirmPaymentMethodSelection,
  } = model;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const selectedMethod = focusable.find((element) => element.dataset.paymentMethod === selectedPaymentMethod);
    selectedMethod?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePaymentMethodSelection();
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
        : (activeIndex === focusable.length - 1 ? 0 : activeIndex + 1);
      if (activeIndex === -1 || nextIndex !== activeIndex + (event.shiftKey ? -1 : 1)) {
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePaymentMethodSelection, open, selectedPaymentMethod]);

  if (!open) return null;

  return (
    <div className={styles.paymentMethodDialogBackdrop} onMouseDown={closePaymentMethodSelection}>
      <div
        ref={dialogRef}
        className={styles.paymentMethodDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-dialog-title"
        aria-describedby="payment-method-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.drawerHeader}>
          <div>
            <h2 id="payment-method-dialog-title" className={styles.drawerTitle}>{t('sales.payment')}</h2>
            <p id="payment-method-dialog-description" className={styles.paymentMethodDialogDescription}>{t('newSale.selectPaymentMethod')}</p>
          </div>
          <button type="button" className={styles.drawerClose} onClick={closePaymentMethodSelection} aria-label={t('newSale.close')}>
            <IconClose />
          </button>
        </div>

        <div className={styles.paymentMethodChoices} role="radiogroup" aria-label={t('sales.payment')}>
          {paymentMethods.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              className={`${styles.paymentMethodChoice} ${selectedPaymentMethod === method ? styles.paymentMethodChoiceActive : ''}`}
              aria-checked={selectedPaymentMethod === method}
              data-payment-method={method}
              onClick={() => choosePaymentMethod(method)}
            >
              {paymentMethodLabel(method)}
            </button>
          ))}
        </div>

        <div className={styles.paymentMethodDialogActions}>
          <button type="button" className={styles.drawerSecondaryBtn} onClick={closePaymentMethodSelection}>{t('newSale.close')}</button>
          <button type="button" className={styles.drawerPrimaryBtn} onClick={confirmPaymentMethodSelection}>{t('newSale.ok')}</button>
        </div>
      </div>
    </div>
  );
}
