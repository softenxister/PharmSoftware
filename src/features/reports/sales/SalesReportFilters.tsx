import { FormattedDateInput } from "@/components/forms/FormattedDateInput";
import type { TranslationKey } from "@/i18n/i18n";
import type { SalesReportRange } from "./salesReportModel";
import styles from "./SalesReports.module.css";

type Translate = (key: TranslationKey) => string;

const ranges = [
  { value: "today", label: "reports.today" },
  { value: "7d", label: "reports.sevenDays" },
  { value: "30d", label: "reports.thirtyDays" },
  { value: "custom", label: "reports.custom" },
] satisfies Array<{ value: SalesReportRange; label: TranslationKey }>;

export function SalesReportFilters({
  range,
  from,
  to,
  onRangeChange,
  onFromChange,
  onToChange,
  onApply,
  t,
}: {
  range: SalesReportRange;
  from: string;
  to: string;
  onRangeChange: (range: SalesReportRange) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  t: Translate;
}) {
  const customReady = Boolean(from && to && from <= to);

  return (
    <div className={styles.filters}>
      <span className={styles.filterLabel}>{t("reports.dateRange")}</span>
      <div className={styles.rangeSegment} aria-label={t("reports.dateRange")}>
        {ranges.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            className={`${styles.rangeButton} ${range === value ? styles.rangeButtonActive : ""}`}
            onClick={() => onRangeChange(value)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className={styles.customDates}>
          <label htmlFor="report-from">{t("reports.from")}</label>
          <FormattedDateInput
            id="report-from"
            value={from}
            onChange={onFromChange}
            calendarLabel={t("reports.from")}
          />
          <span className={styles.dateSeparator} aria-hidden="true">—</span>
          <label htmlFor="report-to">{t("reports.to")}</label>
          <FormattedDateInput
            id="report-to"
            value={to}
            onChange={onToChange}
            calendarLabel={t("reports.to")}
          />
          <button
            type="button"
            className={styles.applyButton}
            disabled={!customReady}
            onClick={onApply}
          >
            {t("reports.apply")}
          </button>
        </div>
      )}
    </div>
  );
}
