import { AlertTriangle, LoaderCircle } from 'lucide-react';
import type { PendingSaleStatusModel } from './workflow/useSaleWorkflow';
import styles from './NewSale.module.css';

export function PendingSaleStatus({ model }: { model: PendingSaleStatusModel }): React.ReactElement | null {
  if (model.loading) {
    return (
      <section className={styles.pendingSaleState} aria-live="polite">
        <LoaderCircle className={styles.pendingSaleSpinner} size={28} aria-hidden="true" />
        <h1>{model.t('newSale.pendingLoading')}</h1>
        <p>{model.t('newSale.pendingLoadingHint')}</p>
      </section>
    );
  }

  if (model.unavailable) {
    return (
      <section className={styles.pendingSaleState} role="alert">
        <AlertTriangle className={styles.pendingSaleStateIcon} size={30} aria-hidden="true" />
        <h1>{model.t('newSale.pendingUnavailable')}</h1>
        <p>{model.t(model.unavailable.reason === 'load-failed'
          ? 'newSale.pendingLoadFailedHint'
          : 'newSale.pendingUnavailableHint')}</p>
        <div className={styles.pendingSaleActions}>
          <button type="button" className={styles.pendingSaleSecondaryButton} onClick={model.returnToSales}>
            {model.t('newSale.returnToSales')}
          </button>
          {model.unavailable.reason === 'load-failed' && (
            <button type="button" className={styles.pendingSaleSecondaryButton} onClick={model.retry}>
              {model.t('newSale.retry')}
            </button>
          )}
          <button type="button" className={styles.pendingSalePrimaryButton} onClick={model.startNewSale}>
            {model.t('newSale.startNewSale')}
          </button>
        </div>
      </section>
    );
  }

  if (!model.conflictMessage) return null;
  return (
    <aside className={styles.pendingSaleConflict} role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div className={styles.pendingSaleConflictCopy}>
        <strong>{model.t('newSale.pendingConflict')}</strong>
        <span>{model.t('newSale.pendingConflictHint')}</span>
      </div>
      <button type="button" className={styles.pendingSaleSecondaryButton} onClick={model.dismissConflict}>
        {model.t('newSale.keepWorking')}
      </button>
      <button type="button" className={styles.pendingSalePrimaryButton} onClick={model.returnToSales}>
        {model.t('newSale.returnToSales')}
      </button>
    </aside>
  );
}
