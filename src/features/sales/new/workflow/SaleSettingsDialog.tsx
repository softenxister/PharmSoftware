import {
  STORE_BILLING_DEVICES,
  STORE_CASH_DRAWER_DEVICES,
  STORE_PAPER_SIZES,
} from '@/config/preferences/storePosSettings';
import styles from '../NewSale.module.css';
import { CustomSelect, IconClose } from './SalePrimitives';
import type { SaleSettingsDialogModel } from './useSaleWorkflow';

export function SaleSettingsDialog({ model }: { model: SaleSettingsDialogModel }) {
  const {
    t,
    settingsOpen,
    closeSettings,
    billingDevice,
    chooseBillingDevice,
    paperSize,
    choosePaperSize,
    cashDrawerDevice,
    chooseCashDrawer,
    autoOpenCashDrawer,
    toggleAutoCashDrawer,
    billingDeviceIsOverridden,
    paperSizeIsOverridden,
    cashDrawerDeviceIsOverridden,
    autoOpenCashDrawerIsOverridden,
    resetBillingDevice,
    resetPaperSize,
    resetCashDrawer,
    resetAutoCashDrawer,
    openPosPreferences,
  } = model;

  if (!settingsOpen) return null;

  return (
    <div className={styles.settingsBackdrop} onClick={closeSettings}>
      <div className={styles.settingsPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{t('newSale.settings')}</h2>
          <button type="button" className={styles.drawerClose} onClick={closeSettings} aria-label={t('newSale.close')}>
            <IconClose />
          </button>
        </div>

        <p className={styles.settingsDialogIntro}>{t('newSale.saleSettingsDescription')}</p>
        <button type="button" className={styles.settingsManageLink} onClick={openPosPreferences}>
          {t('newSale.managePosPreferences')}
        </button>

        <p className={styles.drawerSectionLabel}>{t('newSale.billingDevice')}</p>
        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.receiptPrinter')} {billingDeviceIsOverridden && <span className={styles.settingsOverrideTag}>{t('newSale.currentSaleOnly')}</span>}</span>
          <div className={styles.settingsFieldControl}>
            <CustomSelect
              ariaLabel={t('newSale.receiptPrinter')}
              value={billingDevice}
              options={STORE_BILLING_DEVICES.map((device) => ({ value: device, label: device }))}
              onChange={chooseBillingDevice}
              className={styles.settingsCustomSelect}
            />
            {billingDeviceIsOverridden && <button type="button" className={styles.settingsResetButton} onClick={resetBillingDevice}>{t('newSale.usePosDefault')}</button>}
          </div>
        </div>

        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.paperSize')} {paperSizeIsOverridden && <span className={styles.settingsOverrideTag}>{t('newSale.currentSaleOnly')}</span>}</span>
          <div className={styles.settingsFieldControl}>
            <CustomSelect
              ariaLabel={t('newSale.paperSize')}
              value={paperSize}
              options={STORE_PAPER_SIZES.map((size) => ({ value: size, label: `${size} mm thermal` }))}
              onChange={choosePaperSize}
              className={styles.settingsCustomSelect}
            />
            {paperSizeIsOverridden && <button type="button" className={styles.settingsResetButton} onClick={resetPaperSize}>{t('newSale.usePosDefault')}</button>}
          </div>
        </div>

        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.cashDrawer')} {cashDrawerDeviceIsOverridden && <span className={styles.settingsOverrideTag}>{t('newSale.currentSaleOnly')}</span>}</span>
          <div className={styles.settingsFieldControl}>
            <CustomSelect
              ariaLabel={t('newSale.cashDrawer')}
              value={cashDrawerDevice}
              options={STORE_CASH_DRAWER_DEVICES.map((device) => ({ value: device, label: device }))}
              onChange={chooseCashDrawer}
              className={styles.settingsCustomSelect}
            />
            {cashDrawerDeviceIsOverridden && <button type="button" className={styles.settingsResetButton} onClick={resetCashDrawer}>{t('newSale.usePosDefault')}</button>}
          </div>
        </div>

        <label className={styles.settingsToggle}>
          <span>
            <span className={styles.settingsLabel}>{t('newSale.autoDrawer')} {autoOpenCashDrawerIsOverridden && <span className={styles.settingsOverrideTag}>{t('newSale.currentSaleOnly')}</span>}</span>
            <span className={styles.settingsHelp}>{t('newSale.autoDrawerHint')}</span>
          </span>
          <span className={styles.settingsToggleControl}>
            <input
              type="checkbox"
              checked={autoOpenCashDrawer}
              onChange={(event) => toggleAutoCashDrawer(event.target.checked)}
            />
            {autoOpenCashDrawerIsOverridden && <button type="button" className={styles.settingsResetButton} onClick={resetAutoCashDrawer}>{t('newSale.usePosDefault')}</button>}
          </span>
        </label>

        <div className={styles.devicePreview}>
          <span className={styles.muted}>{t('newSale.currentSetup')}</span>
          <strong>{billingDevice}</strong>
          <span>{paperSize} mm thermal</span>
          <span>{cashDrawerDevice} | {autoOpenCashDrawer ? t('pos.on') : t('pos.off')}</span>
        </div>

        <div className={styles.drawerActions}>
          <button type="button" className={styles.drawerPrimaryBtn} onClick={closeSettings}>
            {t('newSale.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
