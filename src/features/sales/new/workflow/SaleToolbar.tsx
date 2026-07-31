import { Settings } from 'lucide-react';
import {
  getPaymentMethodShortcut,
  shouldUsePaymentToggle,
  type StorePaymentMethod,
} from '@/config/preferences/storePosSettings';
import styles from '../NewSale.module.css';
import { OWNERS } from './saleTypes';
import { CustomSelect, IconChevronDown, IconPill } from './SalePrimitives';
import type { SaleWorkflow } from './useSaleWorkflow';

export function SaleToolbar({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    leaveUnsavedSale,
    ownerId,
    setOwnerId,
    storeSettings,
    paymentMethod,
    setPaymentMethod,
    preferences,
    paymentMethodLabel,
    openReminderCard,
    purchaseMethod,
    setPurchaseMethod,
    saveMenuRef,
    handleSave,
    canSaveSale,
    setSaveMenuOpen,
    saveMenuOpen,
    setSettingsOpen,
  } = sale;

  return (
    <div className={styles.toolbarRow}>
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.breadcrumbLink} onClick={leaveUnsavedSale}>{t('nav.sales')}</button>
        <span className={styles.breadcrumbSep}>&gt;</span>
        <span className={styles.breadcrumbCurrent}>{t('nav.newSale')}</span>
      </div>

      <div className={styles.toolbarControls}>
        <CustomSelect
          ariaLabel={t('common.owner')}
          value={ownerId}
          options={OWNERS.map((owner) => ({ value: owner.id, label: owner.name }))}
          onChange={setOwnerId}
        />

        {shouldUsePaymentToggle(storeSettings.paymentMethods) ? (
          <div className={styles.paymentMethodToggle} role="group" aria-label={t('sales.payment')}>
            {storeSettings.paymentMethods.map((method) => (
              <button
                key={method}
                type="button"
                className={`${styles.paymentMethodToggleOption} ${paymentMethod === method ? styles.paymentMethodToggleOptionActive : ''}`}
                aria-pressed={paymentMethod === method}
                onClick={() => setPaymentMethod(method)}
              >
                {preferences.showKeyboardHints && <kbd>{getPaymentMethodShortcut(method)}</kbd>}
                <span>{paymentMethodLabel(method)}</span>
              </button>
            ))}
          </div>
        ) : (
          <CustomSelect
            ariaLabel={t('sales.payment')}
            value={paymentMethod}
            options={storeSettings.paymentMethods.map((method) => ({
              value: method,
              label: paymentMethodLabel(method),
              shortcut: preferences.showKeyboardHints ? getPaymentMethodShortcut(method) : undefined,
            }))}
            onChange={(method) => setPaymentMethod(method as StorePaymentMethod)}
          />
        )}

        <button type="button" className={styles.reminderButton} onClick={openReminderCard} aria-haspopup="dialog">
          <IconPill />
          <span>{t('newSale.reminder')}</span>
        </button>

        <button
          type="button"
          className={`${styles.fulfilmentToggle} ${purchaseMethod === 'delivery' ? styles.fulfilmentToggleDelivery : ''}`}
          onClick={() => setPurchaseMethod((current) => (current === 'pickup' ? 'delivery' : 'pickup'))}
          aria-label={t('newSale.toggleFulfilment')}
          aria-pressed={purchaseMethod === 'delivery'}
        >
          <span className={styles.fulfilmentLabel}>{t(purchaseMethod === 'pickup' ? 'sales.pickup' : 'sales.delivery')}</span>
          <span className={styles.fulfilmentSwitch} aria-hidden="true"><span className={styles.fulfilmentSwitchThumb} /></span>
        </button>

        <div className={styles.saveSplit} ref={saveMenuRef}>
          <button type="button" className={styles.saveMain} onClick={() => handleSave('save')} disabled={!canSaveSale}>
            <span>{t('newSale.save')}</span>
            {preferences.showKeyboardHints && <kbd className={styles.actionShortcut}>Ctrl + S</kbd>}
          </button>
          <button
            type="button"
            className={styles.saveChevron}
            onClick={() => setSaveMenuOpen((open) => !open)}
            disabled={!canSaveSale}
            aria-haspopup="menu"
            aria-expanded={saveMenuOpen}
            aria-label={t('newSale.moreSave')}
          >
            <IconChevronDown />
          </button>
          {saveMenuOpen && (
            <div className={styles.saveMenu} role="menu">
              <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save')} disabled={!canSaveSale}>{t('newSale.savePending')}</button>
              <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => handleSave('save-new')} disabled={!canSaveSale}>{t('newSale.savePendingNew')}</button>
            </div>
          )}
        </div>

        <button type="button" className={styles.gearButton} title={t('newSale.settings')} aria-label={t('newSale.settings')} onClick={() => setSettingsOpen(true)}>
          <Settings size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
