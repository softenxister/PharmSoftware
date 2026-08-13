import { ChevronRight } from "lucide-react";
import type { TranslationKey } from "@/i18n/i18n";
import type {
  SalesReportResponse,
  SalesReportRow,
} from "@server/db/reports/salesReportModel";
import styles from "./SalesReports.module.css";

type Props = {
  report: SalesReportResponse;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  onSelect: (row: SalesReportRow) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const money = (value: number | null, formatMoney: Props["formatMoney"], unavailable: string) => (
  value === null ? unavailable : `฿${formatMoney(value)}`
);

const percent = (value: number | null, formatNumber: Props["formatNumber"], unavailable: string) => (
  value === null ? unavailable : `${formatNumber(value, { maximumFractionDigits: 2 })}%`
);

function CostStatus({ complete, t }: { complete: boolean; t: Props["t"] }) {
  return (
    <span className={`${styles.costStatus} ${complete ? styles.costComplete : styles.costMissing}`}>
      <span aria-hidden="true" />
      {t(complete ? "reports.costComplete" : "reports.costMissing")}
    </span>
  );
}

function RowLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.rowLink} onClick={onClick}>
      <span>{children}</span>
      <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

function DailyDateCell({
  entry,
  canDrillDown,
  formatDate,
  onSelect,
}: {
  entry: Extract<SalesReportRow, { type: "daily" }>;
  canDrillDown: boolean;
  formatDate: Props["formatDate"];
  onSelect: Props["onSelect"];
}) {
  const label = formatDate(`${entry.date}T00:00:00+07:00`, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <td className={styles.stickyCell}>
      {canDrillDown ? <RowLink onClick={() => onSelect(entry)}>{label}</RowLink> : label}
    </td>
  );
}

export function SalesReportTable({ report, formatDate, formatMoney, formatNumber, onSelect, t }: Props) {
  const unavailable = t("reports.value.unavailable");
  const title = report.view === "daily"
    ? t("reports.daily")
    : report.view === "bill-profit"
      ? t("reports.billProfit")
      : report.view === "product-sales"
        ? t("reports.productSales")
        : t("reports.productProfit");

  return (
    <section className={styles.tablePanel} aria-labelledby="active-report-title">
      <header className={styles.tableHeader}>
        <div>
          <h2 id="active-report-title">{title}</h2>
          <p>{formatDate(`${report.period.from}T00:00:00+07:00`)} — {formatDate(`${report.period.to}T00:00:00+07:00`)}</p>
        </div>
        <span>{t("reports.rows", { count: report.pagination.totalItems })}</span>
      </header>

      <div className={styles.tableScroller}>
        {report.view === "daily" && (
          <table className={`${styles.table} ${styles.dailyTable}`}>
            <thead><tr>
              <th>{t("reports.column.date")}</th>
              <th className={styles.numeric}>{t("reports.column.paidBills")}</th>
              <th className={styles.numeric}>{t("reports.column.itemsSold")}</th>
              <th className={styles.numeric}>{t("reports.column.grossValue")}</th>
              <th className={styles.numeric}>{t("reports.column.billDiscount")}</th>
              <th className={styles.numeric}>{t("reports.column.vat")}</th>
              <th className={styles.numeric}>{t("reports.column.netCollected")}</th>
              {report.canViewProfit && <th className={styles.numeric}>{t("reports.column.cost")}</th>}
              {report.canViewProfit && <th className={styles.numeric}>{t("reports.column.grossDifference")}</th>}
              {report.canViewProfit && <th className={styles.numeric}>{t("reports.column.margin")}</th>}
            </tr></thead>
            <tbody>{report.rows.map((entry) => entry.type === "daily" && (
              <tr key={entry.date}>
                <DailyDateCell entry={entry} canDrillDown={report.canViewProfit} formatDate={formatDate} onSelect={onSelect} />
                <td className={styles.numeric}>{formatNumber(entry.paidBills)}</td>
                <td className={styles.numeric}>{formatNumber(entry.itemsSold)}</td>
                <td className={styles.numeric}>{money(entry.grossProductValue, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.billDiscount, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.vat, formatMoney, unavailable)}</td>
                <td className={`${styles.numeric} ${styles.emphasis}`}>{money(entry.netCollected, formatMoney, unavailable)}</td>
                {report.canViewProfit && <td className={styles.numeric}>{money(entry.cost, formatMoney, unavailable)}</td>}
                {report.canViewProfit && <td className={`${styles.numeric} ${entry.grossDifference !== null && entry.grossDifference < 0 ? styles.negative : ""}`}>{money(entry.grossDifference, formatMoney, unavailable)}</td>}
                {report.canViewProfit && <td className={styles.numeric}>{percent(entry.marginPercent, formatNumber, unavailable)}</td>}
              </tr>
            ))}</tbody>
          </table>
        )}

        {report.view === "bill-profit" && (
          <table className={`${styles.table} ${styles.billTable}`}>
            <thead><tr>
              <th>{t("reports.column.bill")}</th>
              <th>{t("reports.column.date")}</th>
              <th>{t("reports.column.customer")}</th>
              <th>{t("reports.column.payment")}</th>
              <th className={styles.numeric}>{t("reports.column.grossValue")}</th>
              <th className={styles.numeric}>{t("reports.column.billDiscount")}</th>
              <th className={styles.numeric}>{t("reports.column.vat")}</th>
              <th className={styles.numeric}>{t("reports.column.netCollected")}</th>
              <th className={styles.numeric}>{t("reports.column.cost")}</th>
              <th className={styles.numeric}>{t("reports.column.grossDifference")}</th>
              <th className={styles.numeric}>{t("reports.column.margin")}</th>
            </tr></thead>
            <tbody>{report.rows.map((entry) => entry.type === "bill-profit" && (
              <tr key={entry.saleId}>
                <td className={styles.stickyCell}><RowLink onClick={() => onSelect(entry)}>{entry.billNo}</RowLink></td>
                <td><span className={styles.dateTime}>{formatDate(entry.soldAt, { day: "2-digit", month: "short", year: "numeric" })}<small>{formatDate(entry.soldAt, { hour: "2-digit", minute: "2-digit" })}</small></span></td>
                <td><span className={styles.truncate} title={entry.customerName}>{entry.customerName}</span></td>
                <td>{entry.paymentMethod}</td>
                <td className={styles.numeric}>{money(entry.grossProductValue, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.billDiscount, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.vat, formatMoney, unavailable)}</td>
                <td className={`${styles.numeric} ${styles.emphasis}`}>{money(entry.netCollected, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.cost, formatMoney, unavailable)}</td>
                <td className={`${styles.numeric} ${entry.grossDifference !== null && entry.grossDifference < 0 ? styles.negative : ""}`}>{money(entry.grossDifference, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{percent(entry.marginPercent, formatNumber, unavailable)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}

        {report.view === "product-sales" && (
          <table className={`${styles.table} ${styles.productTable}`}>
            <thead><tr>
              <th>{t("reports.column.product")}</th>
              <th>{t("reports.column.pack")}</th>
              <th className={styles.numeric}>{t("reports.column.quantity")}</th>
              <th className={styles.numeric}>{t("reports.column.paidBills")}</th>
              <th className={styles.numeric}>{t("reports.column.averageSell")}</th>
              <th className={styles.numeric}>{t("reports.column.productSales")}</th>
            </tr></thead>
            <tbody>{report.rows.map((entry) => entry.type === "product-sales" && (
              <tr key={`${entry.productId}-${entry.packLabel}`}>
                <td className={styles.stickyCell}><RowLink onClick={() => onSelect(entry)}><span className={styles.productIdentity}><strong title={entry.productName}>{entry.productName}</strong><small>{entry.productCode}</small></span></RowLink></td>
                <td>{entry.packLabel}</td>
                <td className={styles.numeric}>{formatNumber(entry.quantitySold, { maximumFractionDigits: 3 })}</td>
                <td className={styles.numeric}>{formatNumber(entry.paidBills)}</td>
                <td className={styles.numeric}>{money(entry.averageSellPrice, formatMoney, unavailable)}</td>
                <td className={`${styles.numeric} ${styles.emphasis}`}>{money(entry.productSales, formatMoney, unavailable)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}

        {report.view === "product-profit" && (
          <table className={`${styles.table} ${styles.productProfitTable}`}>
            <thead><tr>
              <th>{t("reports.column.product")}</th>
              <th>{t("reports.column.pack")}</th>
              <th className={styles.numeric}>{t("reports.column.quantity")}</th>
              <th className={styles.numeric}>{t("reports.column.productSales")}</th>
              <th className={styles.numeric}>{t("reports.column.averageCost")}</th>
              <th className={styles.numeric}>{t("reports.column.cost")}</th>
              <th className={styles.numeric}>{t("reports.column.grossDifference")}</th>
              <th className={styles.numeric}>{t("reports.column.margin")}</th>
              <th>{t("reports.column.costStatus")}</th>
            </tr></thead>
            <tbody>{report.rows.map((entry) => entry.type === "product-profit" && (
              <tr key={`${entry.productId}-${entry.packLabel}`}>
                <td className={styles.stickyCell}><RowLink onClick={() => onSelect(entry)}><span className={styles.productIdentity}><strong title={entry.productName}>{entry.productName}</strong><small>{entry.productCode}</small></span></RowLink></td>
                <td>{entry.packLabel}</td>
                <td className={styles.numeric}>{formatNumber(entry.quantitySold, { maximumFractionDigits: 3 })}</td>
                <td className={`${styles.numeric} ${styles.emphasis}`}>{money(entry.productSales, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.averageUnitCost, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{money(entry.cost, formatMoney, unavailable)}</td>
                <td className={`${styles.numeric} ${entry.grossDifference !== null && entry.grossDifference < 0 ? styles.negative : ""}`}>{money(entry.grossDifference, formatMoney, unavailable)}</td>
                <td className={styles.numeric}>{percent(entry.marginPercent, formatNumber, unavailable)}</td>
                <td><CostStatus complete={entry.hasCompleteCost} t={t} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
