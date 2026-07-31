import styles from '../NewSale.module.css';
import { CustomSelect, IconClose } from './SalePrimitives';
import type { SaleWorkflow } from './useSaleWorkflow';

export function SaleSettingsDialog({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    settingsOpen,
    setSettingsOpen,
    billingDevice,
    setBillingDevice,
    paperSize,
    setPaperSize,
    cashDrawerDevice,
    setCashDrawerDevice,
    autoOpenCashDrawer,
    setAutoOpenCashDrawer,
  } = sale;

  if (!settingsOpen) return null;

  return (
    <div className={styles.settingsBackdrop} onClick={() => setSettingsOpen(false)}>
      <div className={styles.settingsPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{t('newSale.settings')}</h2>
          <button type="button" className={styles.drawerClose} onClick={() => setSettingsOpen(false)} aria-label={t('newSale.close')}>
            <IconClose />
          </button>
        </div>

        <p className={styles.drawerSectionLabel}>{t('newSale.billingDevice')}</p>
        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.receiptPrinter')}</span>
          <CustomSelect
            ariaLabel={t('newSale.receiptPrinter')}
            value={billingDevice}
            options={[
              { value: 'Front Counter Thermal Printer', label: 'Front Counter Thermal Printer' },
              { value: 'Back Counter Thermal Printer', label: 'Back Counter Thermal Printer' },
              { value: 'PDF Preview Only', label: 'PDF Preview Only' },
              { value: 'USB Receipt Printer', label: 'USB Receipt Printer' },
            ]}
            onChange={setBillingDevice}
            className={styles.settingsCustomSelect}
          />
        </div>

        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.paperSize')}</span>
          <CustomSelect
            ariaLabel={t('newSale.paperSize')}
            value={paperSize}
            options={[
              { value: '80', label: '80 mm thermal' },
              { value: '58', label: '58 mm thermal' },
            ]}
            onChange={(value) => {
              window.localStorage.setItem('pharm_receipt_paper_size', value);
              setPaperSize(value);
            }}
            className={styles.settingsCustomSelect}
          />
        </div>

        <div className={styles.settingsField}>
          <span className={styles.settingsLabel}>{t('newSale.cashDrawer')}</span>
          <CustomSelect
            ariaLabel={t('newSale.cashDrawer')}
            value={cashDrawerDevice}
            options={[
              { value: 'Front Counter Cash Drawer', label: 'Front Counter Cash Drawer' },
              { value: 'Back Counter Cash Drawer', label: 'Back Counter Cash Drawer' },
              { value: 'Printer-connected Drawer', label: 'Printer-connected Drawer' },
              { value: 'No Cash Drawer', label: 'No Cash Drawer' },
            ]}
            onChange={setCashDrawerDevice}
            className={styles.settingsCustomSelect}
          />
        </div>

        <label className={styles.settingsToggle}>
          <span>
            <span className={styles.settingsLabel}>{t('newSale.autoDrawer')}</span>
            <span className={styles.settingsHelp}>{t('newSale.autoDrawerHint')}</span>
          </span>
          <input
            type="checkbox"
            checked={autoOpenCashDrawer}
            onChange={(event) => setAutoOpenCashDrawer(event.target.checked)}
          />
        </label>

        <div className={styles.devicePreview}>
          <span className={styles.muted}>{t('newSale.currentSetup')}</span>
          <strong>{billingDevice}</strong>
          <span>{paperSize} mm thermal</span>
          <span>{cashDrawerDevice} | {autoOpenCashDrawer ? t('pos.on') : t('pos.off')}</span>
        </div>

        <div className={styles.drawerActions}>
          <button type="button" className={styles.drawerPrimaryBtn} onClick={() => setSettingsOpen(false)}>
            {t('newSale.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
