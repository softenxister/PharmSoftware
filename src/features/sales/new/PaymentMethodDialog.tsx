import { useEffect, useRef } from 'react';
import { Banknote, CreditCard, Landmark } from 'lucide-react';
import type { StorePaymentMethod } from '@/config/preferences/storePosSettings';
import styles from './NewSale.module.css';

export function PaymentMethodDialog({
  open,
  methods,
  selectedMethod,
  paymentMethodLabel,
  title,
  description,
  closeLabel,
  onCancel,
  onChoose,
}: {
  open: boolean;
  methods: readonly StorePaymentMethod[];
  selectedMethod: StorePaymentMethod;
  paymentMethodLabel: (method: StorePaymentMethod) => string;
  title: string;
  description: string;
  closeLabel: string;
  onCancel: () => void;
  onChoose: (method: StorePaymentMethod) => void;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(0, methods.indexOf(selectedMethod));
    optionRefs.current[selectedIndex]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || methods.length === 0) return;

      const first = optionRefs.current[0];
      const lastOption = optionRefs.current[methods.length - 1];
      const last = cancelButtonRef.current;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
        event.preventDefault();
        lastOption?.focus();
      } else if (!event.shiftKey && document.activeElement === lastOption) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [methods, open, selectedMethod]);

  if (!open) return null;

  return (
    <div className={styles.paymentMethodBackdrop} onMouseDown={onCancel}>
      <div
        className={styles.paymentMethodDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-title"
        aria-describedby="payment-method-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="payment-method-title" className={styles.paymentMethodDialogTitle}>{title}</h2>
        <p id="payment-method-description" className={styles.paymentMethodDialogDescription}>{description}</p>

        <div className={styles.paymentMethodOptions} role="group" aria-label={title}>
          {methods.map((method, index) => (
            <button
              key={method}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              className={`${styles.paymentMethodOption} ${method === 'Cash' ? styles.paymentMethodOptionCash : method === 'Bank transfer' ? styles.paymentMethodOptionBank : styles.paymentMethodOptionCard} ${method === selectedMethod ? styles.paymentMethodOptionSelected : ''}`}
              aria-pressed={method === selectedMethod}
              onClick={() => onChoose(method)}
            >
              <span className={styles.paymentMethodOptionIcon} aria-hidden="true">
                {method === 'Cash' ? <Banknote size={18} strokeWidth={1.8} /> : method === 'Bank transfer' ? <Landmark size={18} strokeWidth={1.8} /> : <CreditCard size={18} strokeWidth={1.8} />}
              </span>
              <span>{paymentMethodLabel(method)}</span>
              {method === selectedMethod && <span className={styles.paymentMethodOptionCheck} aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>

        <button ref={cancelButtonRef} type="button" className={styles.paymentMethodDialogCancel} onClick={onCancel}>{closeLabel}</button>
      </div>
    </div>
  );
}
