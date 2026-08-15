import { Link } from "react-router";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import { ProductImage } from "@/components/product/ProductImage";
import type { TranslationKey, TranslationParams } from "@/i18n/i18n";
import styles from "./Dashboard.module.css";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function DashboardStockPanel({
  inventory,
  formatDate,
  formatNumber,
  t,
}: {
  inventory: DashboardResponse["inventory"];
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translate;
}) {
  return (
    <section className={styles.panel} aria-labelledby="dashboard-stock-title">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="dashboard-stock-title">{t("dashboard.stockQueue")}</h2>
          <p>{t("dashboard.stockQueueSubtitle")}</p>
        </div>
        <Link to="/stock" className={styles.textLink}>{t("dashboard.viewStock")}</Link>
      </header>
      <div className={styles.stockCounts}>
        <div className={styles.stockCountCritical}>
          <strong>{formatNumber(inventory.outOfStock)}</strong>
          <span>{t("dashboard.outOfStock")}</span>
        </div>
        <div className={styles.stockCountWarning}>
          <strong>{formatNumber(inventory.lowStock)}</strong>
          <span>{t("dashboard.lowStock")}</span>
        </div>
        <div className={styles.stockCountWarning}>
          <strong>{formatNumber(inventory.expiringWithin30Days)}</strong>
          <span>{t("dashboard.expiring30")}</span>
        </div>
      </div>
      {inventory.items.length === 0 ? (
        <div className={styles.compactEmpty}>{t("dashboard.noStockAlerts")}</div>
      ) : (
        <ul className={styles.alertList}>
          {inventory.items.map((item, index) => (
            <li key={item.productId}>
              <span className={styles.alertImageFrame}>
                <ProductImage
                  priority={index < 3}
                  src={item.imageUrl}
                  alt={t("dashboard.productImage", { name: item.name })}
                  width={36}
                  height={36}
                  className={styles.alertImage}
                />
              </span>
              <div>
                <strong title={item.name}>{item.name}</strong>
                <span className={styles.expiredDescription}>
                  <span className={styles.expiredLabel}>{t("dashboard.expired")}</span>
                  {" · " + formatDate(item.expiryDate + "T00:00:00+07:00")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
