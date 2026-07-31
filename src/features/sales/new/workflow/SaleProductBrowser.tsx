import { nearestAvailableExpiryBatch } from '@/lib/batchPresentation';
import styles from '../NewSale.module.css';
import { buildProductDescription, formatBaht } from './saleDraft';
import type { Batch } from './saleTypes';
import type { SaleWorkflow } from './useSaleWorkflow';

function nearestExpiryBatch(batches: Batch[]): Batch | null {
  return nearestAvailableExpiryBatch(
    batches,
    (batch) => batch.exp,
    (batch) => batch.stock,
  );
}

export function SaleProductBrowser({ sale }: { sale: SaleWorkflow }) {
  const {
    topItems,
    localizeUnit,
    storeSettings,
    preferences,
    startHold,
    endHold,
    handleTopItemTap,
    heldItemId,
    t,
    topItemsLabel,
  } = sale;

  if (topItems.length === 0) return null;

  return (
    <div className={styles.topItemsSection}>
      <div className={styles.topItemsRail}>
        {topItems.map((item) => {
          const nearest = nearestExpiryBatch(item.batches);
          const productDescription = buildProductDescription({
            brand: item.brand,
            packLabel: localizeUnit(item.packLabel),
            location: item.loc,
            totalStock: item.batches.reduce((sum, batch) => sum + batch.stock, 0),
            showLocation: storeSettings.showProductLocation,
            showStock: preferences.showAvailableStock,
          });
          return (
            <button
              key={item.id}
              type="button"
              className={styles.topItemCard}
              onMouseDown={() => startHold(item.id)}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={() => startHold(item.id)}
              onTouchEnd={endHold}
              onClick={() => handleTopItemTap(item)}
            >
              <img src={item.image} alt={item.name} className={styles.topItemImage} />
              <span className={styles.topItemDetail} aria-hidden="true">
                <span className={styles.topItemDetailName}>{item.name}</span>
                <span className={styles.topItemDetailSub}>{productDescription}</span>
                <span className={styles.topItemDetailBottom}>
                  <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                </span>
              </span>
              {heldItemId === item.id && (
                <div className={styles.topItemTouchPreview}>
                  <span className={styles.topItemDetailName}>{item.name}</span>
                  <span className={styles.topItemDetailSub}>{productDescription}</span>
                  <span className={styles.topItemDetailBottom}>
                    <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.topItemsLabel}>{topItemsLabel}</p>
    </div>
  );
}
