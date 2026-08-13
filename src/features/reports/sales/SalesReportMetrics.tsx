import type { TranslationKey } from "@/i18n/i18n";
import type { SalesReportMetric } from "@server/db/reports/salesReportModel";
import styles from "./SalesReports.module.css";

const metricLabel = (key: SalesReportMetric["key"]): TranslationKey => `reports.metric.${key}` as TranslationKey;

export function SalesReportMetrics({
  metrics,
  formatMoney,
  formatNumber,
  t,
}: {
  metrics: SalesReportMetric[];
  formatMoney: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: (key: TranslationKey) => string;
}) {
  return (
    <section className={styles.metrics} aria-label={t("reports.title")}>
      {metrics.map((metric) => {
        const value = metric.value === null
          ? t("reports.value.unavailable")
          : metric.format === "money"
            ? `฿${formatMoney(metric.value)}`
            : metric.format === "percent"
              ? `${formatNumber(metric.value, { maximumFractionDigits: 2 })}%`
              : formatNumber(metric.value, { maximumFractionDigits: 3 });
        return (
          <div key={metric.key} className={styles.metric}>
            <span>{t(metricLabel(metric.key))}</span>
            <strong>{value}</strong>
          </div>
        );
      })}
    </section>
  );
}
