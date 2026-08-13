import { CalendarDays, CircleDollarSign, PackageSearch, ReceiptText } from "lucide-react";
import type { TranslationKey } from "@/i18n/i18n";
import type { SalesReportView } from "@server/db/reports/salesReportModel";
import styles from "./SalesReports.module.css";

type Translate = (key: TranslationKey) => string;

const options = [
  { view: "daily", title: "reports.daily", description: "reports.dailyDesc", icon: CalendarDays },
  { view: "bill-profit", title: "reports.billProfit", description: "reports.billProfitDesc", icon: ReceiptText },
  { view: "product-sales", title: "reports.productSales", description: "reports.productSalesDesc", icon: PackageSearch },
  { view: "product-profit", title: "reports.productProfit", description: "reports.productProfitDesc", icon: CircleDollarSign },
] satisfies Array<{
  view: SalesReportView;
  title: TranslationKey;
  description: TranslationKey;
  icon: typeof CalendarDays;
}>;

export function SalesReportSelector({
  view,
  canViewProfit,
  onSelect,
  t,
}: {
  view: SalesReportView;
  canViewProfit: boolean;
  onSelect: (view: SalesReportView) => void;
  t: Translate;
}) {
  const visibleOptions = options.filter((option) => (
    canViewProfit || option.view === "daily" || option.view === "product-sales"
  ));

  return (
    <div className={styles.selectorScroller}>
      <div className={styles.selector} role="tablist" aria-label={t("reports.title")}>
        {visibleOptions.map(({ view: optionView, title, description, icon: Icon }) => {
          const isActive = view === optionView;
          return (
            <button
              key={optionView}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.selectorTab} ${isActive ? styles.selectorTabActive : ""}`}
              onClick={() => onSelect(optionView)}
            >
              <span className={styles.selectorIcon}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className={styles.selectorCopy}>
                <strong>{t(title)}</strong>
                <small>{t(description)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
