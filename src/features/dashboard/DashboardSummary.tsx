import { Link } from "react-router";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import type { TranslationKey, TranslationParams } from "@/i18n/i18n";
import styles from "./Dashboard.module.css";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function DashboardSummary({
  dashboard,
  formatMoney,
  formatNumber,
  t,
}: {
  dashboard: DashboardResponse;
  formatMoney: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translate;
}) {
  const stockAttention = dashboard.inventory.outOfStock + dashboard.inventory.lowStock;
  return (
    <section className={styles.summaryStrip} aria-label={t("dashboard.todaySummary")}>
      <div className={styles.summaryMetric}>
        <span className={styles.metricLabel}>{t("dashboard.netSales")}</span>
        <strong>{"฿" + formatMoney(dashboard.today.netSales)}</strong>
      </div>
      <div className={styles.summaryMetric}>
        <span className={styles.metricLabel}>{t("dashboard.netPurchases")}</span>
        <strong>{"฿" + formatMoney(dashboard.today.netPurchases)}</strong>
      </div>
      <div className={styles.summaryMetric}>
        <span className={styles.metricLabel}>{t("dashboard.paidBills")}</span>
        <strong>{formatNumber(dashboard.today.paidBills)}</strong>
      </div>
      <div className={styles.summaryMetric}>
        <span className={styles.metricLabel}>{t("dashboard.averageBill")}</span>
        <strong>{dashboard.today.averageBill === null
          ? "—"
          : "฿" + formatMoney(dashboard.today.averageBill)}</strong>
      </div>
      <Link to="/stock" className={styles.summaryMetric}>
        <span className={styles.metricLabel}>{t("dashboard.stockAttention")}</span>
        <strong>{formatNumber(stockAttention)}</strong>
      </Link>
    </section>
  );
}
