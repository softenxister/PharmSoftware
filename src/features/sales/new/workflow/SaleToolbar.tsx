import { ArrowLeftRight, Settings, Trash2 } from 'lucide-react';
import {
  getPaymentMethodShortcut,
  shouldUsePaymentToggle,
  type StorePaymentMethod,
} from '@/config/preferences/storePosSettings';
import styles from '../NewSale.module.css';
import { OWNERS } from './saleTypes';
import { CustomSelect, IconChevronDown, IconPill } from './SalePrimitives';
import type { SaleToolbarModel } from './useSaleWorkflow';

export function SaleToolbar({ model }: { model: SaleToolbarModel }) {
  const {
    t,
    leaveSale,
    ownerId,
    chooseOwner,
    paymentMethod,
    paymentMethods,
    choosePaymentMethod,
    showKeyboardHints,
    paymentMethodLabel,
    openReminder,
    purchaseMethod,
    toggleFulfilment,
    saveMenuRef,
    save,
    canSaveSale,
    toggleSaveMenu,
    saveMenuOpen,
    canDeleteBill,
    deleteBillSubmitting,
    requestDeleteBill,
    openSettings,
  } = model;

  return (
    <div className={styles.toolbarRow}>
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.breadcrumbLink} onClick={leaveSale}>{t('nav.sales')}</button>
        <span className={styles.breadcrumbSep}>&gt;</span>
        <span className={styles.breadcrumbCurrent}>{t('nav.newSale')}</span>
      </div>

      <div className={styles.toolbarControls}>
        <CustomSelect
          ariaLabel={t('common.owner')}
          value={ownerId}
          options={OWNERS.map((owner) => ({ value: owner.id, label: owner.name }))}
          onChange={chooseOwner}
        />

        {shouldUsePaymentToggle(paymentMethods) ? (
          <button
            type="button"
            className={`${styles.paymentMethodToggle} ${paymentMethod === 'Cash' ? styles.paymentMethodToggleCash : styles.paymentMethodToggleBank}`}
            onClick={() => choosePaymentMethod(paymentMethod === 'Cash' ? 'Bank transfer' : 'Cash')}
            aria-label={t('newSale.togglePaymentMethod')}
          >
            <span>{paymentMethod === 'Cash' ? t('pos.cash') : t('pos.bank')}</span>
            <ArrowLeftRight className={styles.paymentMethodToggleIcon} size={16} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : (
          <CustomSelect
            ariaLabel={t('sales.payment')}
            value={paymentMethod}
            options={paymentMethods.map((method) => ({
              value: method,
              label: paymentMethodLabel(method),
              shortcut: showKeyboardHints ? getPaymentMethodShortcut(method) : undefined,
            }))}
            onChange={(method) => choosePaymentMethod(method as StorePaymentMethod)}
          />
        )}

        <button type="button" className={styles.reminderButton} onClick={openReminder} aria-haspopup="dialog">
          <IconPill />
          <span>{t('newSale.reminder')}</span>
        </button>

        <button
          type="button"
          className={`${styles.fulfilmentToggle} ${purchaseMethod === 'delivery' ? styles.fulfilmentToggleDelivery : ''}`}
          onClick={toggleFulfilment}
          aria-label={t('newSale.toggleFulfilment')}
          aria-pressed={purchaseMethod === 'delivery'}
        >
          <span className={styles.fulfilmentLabel}>{t(purchaseMethod === 'pickup' ? 'sales.pickup' : 'sales.delivery')}</span>
          <span className={styles.fulfilmentSwitch} aria-hidden="true"><span className={styles.fulfilmentSwitchThumb} /></span>
        </button>

        <div className={styles.saveSplit} ref={saveMenuRef}>
          <button type="button" className={styles.saveMain} onClick={() => save('save')} disabled={!canSaveSale}>
            <span>{t('newSale.save')}</span>
            {showKeyboardHints && <kbd className={styles.actionShortcut}>Ctrl + S</kbd>}
          </button>
          <button
            type="button"
            className={styles.saveChevron}
            onClick={toggleSaveMenu}
            disabled={!canSaveSale}
            aria-haspopup="menu"
            aria-expanded={saveMenuOpen}
            aria-label={t('newSale.moreSave')}
          >
            <IconChevronDown />
          </button>
          {saveMenuOpen && (
            <div className={styles.saveMenu} role="menu">
              <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => save('save')} disabled={!canSaveSale}>{t('newSale.savePending')}</button>
              <button type="button" role="menuitem" className={styles.saveMenuItem} onClick={() => save('save-new')} disabled={!canSaveSale}>{t('newSale.savePendingNew')}</button>
            </div>
          )}
        </div>

        {canDeleteBill && (
          <button
            type="button"
            className={styles.deleteBillButton}
            onClick={requestDeleteBill}
            disabled={deleteBillSubmitting}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{t('newSale.deleteBill')}</span>
          </button>
        )}

        <button type="button" className={styles.gearButton} title={t('newSale.settings')} aria-label={t('newSale.settings')} onClick={openSettings}>
          <Settings size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
