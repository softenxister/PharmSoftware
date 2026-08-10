import { displayBatchField } from '@/lib/batchPresentation';
import styles from '../NewSale.module.css';
import {
  catalogItemForLine,
  formatBaht,
  lineUnitPrice,
} from './saleDraft';
import { IconBin } from './SalePrimitives';
import type { SaleCartTableModel } from './useSaleWorkflow';

export function SaleCartTable({ model }: { model: SaleCartTableModel }) {
  const {
    t,
    cartDisplayGroups,
    catalog,
    showProductLocation,
    allergyWarningForItem,
    localizeUnit,
    formatExpiry,
    removeLine,
    updateQuantity,
    changeQuantity,
    clearEmptyQuantity,
    cartQtyDrafts,
  } = model;

  if (cartDisplayGroups.length === 0) return null;

  return (
    <div className={styles.cartTableWrap}>
      <table className={styles.cartTable}>
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>{t('newSale.item')}</th>
            <th>{t('newSale.pack')}</th>
            {showProductLocation && <th>{t('newSale.locationShort')}</th>}
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
                  <button type="button" className={styles.binButton} onClick={() => removeLine(group.key)} aria-label={`Remove ${line.itemName}`}>
                    <IconBin />
                  </button>
                </td>
                <td className={styles.itemNameCell}>
                  <span className={styles.cartItemName}>{line.itemName}</span>
                  {allergyWarning && <strong className={styles.allergyWarning}>{allergyWarning}</strong>}
                </td>
                <td className={styles.packCell}><span className={styles.packCellUnit}>{localizeUnit(line.packLabel)}</span></td>
                {showProductLocation && <td className={styles.muted}>{line.loc}</td>}
                <td className={styles.muted}>{displayBatchField(line.batch.batchNo)}</td>
                <td className={styles.muted}>{formatExpiry(line.batch.exp)}</td>
                <td className={styles.alignRight}>฿{formatBaht(lineUnitPrice(line))}</td>
                <td className={styles.alignRight}>
                  <div className={styles.qtyStepper}>
                    <button type="button" className={styles.qtyStepButton} onClick={() => updateQuantity(group.key, group.quantity - 1)} aria-label={`Decrease ${line.itemName} quantity`}>-</button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cartQtyDrafts[group.key] ?? String(group.quantity)}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => clearEmptyQuantity(group.key)}
                      onChange={(event) => changeQuantity(group.key, event.target.value)}
                      className={styles.qtyStepperInput}
                    />
                    <button type="button" className={styles.qtyStepButton} onClick={() => updateQuantity(group.key, group.quantity + 1)} aria-label={`Increase ${line.itemName} quantity`}>+</button>
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
