import { nearestAvailableExpiryBatch } from '@/lib/batchPresentation';
import { ProductImage } from '@/components/product/ProductImage';
import styles from '../NewSale.module.css';
import { buildProductDescription, formatBaht } from './saleDraft';
import type { Batch } from './saleTypes';
import type { SaleProductBrowserModel } from './useSaleWorkflow';

function nearestExpiryBatch(batches: Batch[]): Batch | null {
  return nearestAvailableExpiryBatch(
    batches,
    (batch) => batch.exp,
    (batch) => batch.stock,
  );
}

export function SaleProductBrowser({ model }: { model: SaleProductBrowserModel }) {
  const {
    topItems,
    localizeUnit,
    showProductLocation,
    showAvailableStock,
    startHold,
    endHold,
    openItem,
    heldItemId,
    t,
    topItemsLabel,
  } = model;

  if (topItems.length === 0) return null;

  return (
    <div className={styles.topItemsSection}>
      <div className={styles.topItemsRail}>
        {topItems.map((item, index) => {
          const nearest = nearestExpiryBatch(item.batches);
          const productDescription = buildProductDescription({
            brand: item.brand,
            packLabel: localizeUnit(item.packLabel),
            location: item.loc,
            totalStock: item.batches.reduce((sum, batch) => sum + batch.stock, 0),
            showLocation: showProductLocation,
            showStock: showAvailableStock,
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
              onClick={() => openItem(item)}
            >
              <ProductImage
                priority={index < 4}
                src={item.image}
                alt={item.name}
                width={86}
                height={86}
                className={styles.topItemImage}
              />
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
