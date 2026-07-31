import { displayBatchField } from '@/lib/batchPresentation';
import styles from '../NewSale.module.css';
import {
  catalogItemForLine,
  formatBaht,
  lineUnitPrice,
  normalizeThaiKeyboardNumericInput,
} from './saleDraft';
import { IconBin } from './SalePrimitives';
import type { SaleWorkflow } from './useSaleWorkflow';

export function SaleCartTable({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    cartLines,
    storeSettings,
    cartDisplayGroups,
    catalog,
    allergyWarningForItem,
    localizeUnit,
    formatExpiry,
    removeCartLine,
    updateCartQty,
    cartQtyDrafts,
    setCartQtyDrafts,
  } = sale;

  if (cartLines.length === 0) return null;

  return (
    <div className={styles.cartTableWrap}>
      <table className={styles.cartTable}>
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>{t('newSale.item')}</th>
            <th>{t('newSale.pack')}</th>
            {storeSettings.showProductLocation && <th>{t('newSale.locationShort')}</th>}
            <th>{t('newSale.batch')}</th>
            <th>{t('newSale.expiryShort')}</th>
            <th className={styles.alignRight}>{t('newSale.price')}</th>
            <th className={styles.alignRight}>{t('newSale.quantityShort')}</th>
            <th className={styles.alignRight}>{t('newSale.lineTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {cartDisplayGroups.map((group) => {
            const line = group.representative;
            const catalogItem = catalogItemForLine(line, catalog);
            const allergyWarning = catalogItem ? allergyWarningForItem(catalogItem) : '';
            const lineTotal = group.lines.reduce(
              (total, batchLine) => total + batchLine.qty * lineUnitPrice(batchLine),
              0,
            );
            return (
              <tr key={group.key}>
                <td>
                  <button type="button" className={styles.binButton} onClick={() => removeCartLine(group.key)} aria-label={`Remove ${line.itemName}`}>
                    <IconBin />
                  </button>
                </td>
                <td className={styles.itemNameCell}>
                  <span className={styles.cartItemName}>{line.itemName}</span>
                  {allergyWarning && <strong className={styles.allergyWarning}>{allergyWarning}</strong>}
                </td>
                <td className={styles.packCell}><span className={styles.packCellUnit}>{localizeUnit(line.packLabel)}</span></td>
                {storeSettings.showProductLocation && <td className={styles.muted}>{line.loc}</td>}
                <td className={styles.muted}>{displayBatchField(line.batch.batchNo)}</td>
                <td className={styles.muted}>{formatExpiry(line.batch.exp)}</td>
                <td className={styles.alignRight}>฿{formatBaht(lineUnitPrice(line))}</td>
                <td className={styles.alignRight}>
                  <div className={styles.qtyStepper}>
                    <button type="button" className={styles.qtyStepButton} onClick={() => updateCartQty(group.key, group.quantity - 1)} aria-label={`Decrease ${line.itemName} quantity`}>-</button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cartQtyDrafts[group.key] ?? String(group.quantity)}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => {
                        setCartQtyDrafts((drafts) => {
                          if (drafts[group.key] !== '') return drafts;
                          const next = { ...drafts };
                          delete next[group.key];
                          return next;
                        });
                      }}
                      onChange={(event) => {
                        const digitsOnly = normalizeThaiKeyboardNumericInput(event.target.value).replace(/\D/g, '');
                        if (!digitsOnly) {
                          setCartQtyDrafts((drafts) => ({ ...drafts, [group.key]: '' }));
                          return;
                        }
                        setCartQtyDrafts((drafts) => ({ ...drafts, [group.key]: digitsOnly }));
                        updateCartQty(group.key, parseInt(digitsOnly, 10));
                      }}
                      className={styles.qtyStepperInput}
                    />
                    <button type="button" className={styles.qtyStepButton} onClick={() => updateCartQty(group.key, group.quantity + 1)} aria-label={`Increase ${line.itemName} quantity`}>+</button>
                  </div>
                </td>
                <td className={styles.alignRight}><span className={styles.lineTotal}>฿{formatBaht(lineTotal)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
