import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import type { TranslationKey } from "@/i18n/i18n";
import type { SalesReportRow } from "@server/db/reports/salesReportModel";
import styles from "./SalesReports.module.css";

export function SalesReportDetailDrawer({
  row,
  onClose,
  formatDate,
  formatMoney,
  formatNumber,
  t,
}: {
  row: SalesReportRow | null;
  onClose: () => void;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: (key: TranslationKey) => string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, row]);

  if (!row || row.type === "daily") return null;
  const title = row.type === "bill-profit" ? row.billNo : row.productName;
  const subtitle = row.type === "bill-profit"
    ? formatDate(row.soldAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : `${row.productCode} · ${row.packLabel}`;
  const unavailable = t("reports.value.unavailable");
  const money = (value: number | null) => value === null ? unavailable : `฿${formatMoney(value)}`;

  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="report-drawer-title">
        <header className={styles.drawerHeader}>
          <div>
            <span>{t("reports.details")}</span>
            <h2 id="report-drawer-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button ref={closeRef} type="button" className={styles.iconButton} onClick={onClose} aria-label={t("reports.close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {row.type === "bill-profit" && (
          <>
            <div className={styles.drawerSummary}>
              <div><span>{t("reports.metric.netCollected")}</span><strong>{money(row.netCollected)}</strong></div>
              <div><span>{t("reports.metric.cost")}</span><strong>{money(row.cost)}</strong></div>
              <div><span>{t("reports.metric.grossDifference")}</span><strong>{money(row.grossDifference)}</strong></div>
              <div><span>{t("reports.metric.marginPercent")}</span><strong>{row.marginPercent === null ? unavailable : `${formatNumber(row.marginPercent, { maximumFractionDigits: 2 })}%`}</strong></div>
            </div>
            {!row.hasCompleteCost && (
              <div className={styles.drawerNotice}>{t("reports.costMissingHint")}</div>
            )}
            <section className={styles.drawerLines}>
              <h3>{t("reports.contributingLines")}</h3>
              {row.lines.map((line) => (
                <div key={`${line.productId}-${line.packLabel}`} className={styles.drawerLine}>
                  <div><strong>{line.itemName}</strong><small>{line.productCode} · {line.packLabel}</small></div>
                  <span>{formatNumber(line.quantity, { maximumFractionDigits: 3 })}</span>
                  <span>{money(line.productSales)}</span>
                  <span>{line.unitCost === null ? unavailable : money(line.unitCost * line.quantity)}</span>
                </div>
              ))}
            </section>
            <a className={styles.receiptLink} href={`/sales/receipt/${encodeURIComponent(row.saleId)}`} target="_blank" rel="noreferrer">
              {t("reports.openReceipt")}<ExternalLink size={14} aria-hidden="true" />
            </a>
          </>
        )}

        {row.type === "product-sales" && (
          <div className={styles.drawerSummary}>
            <div><span>{t("reports.metric.productSales")}</span><strong>{money(row.productSales)}</strong></div>
            <div><span>{t("reports.metric.quantitySold")}</span><strong>{formatNumber(row.quantitySold, { maximumFractionDigits: 3 })}</strong></div>
            <div><span>{t("reports.column.averageSell")}</span><strong>{money(row.averageSellPrice)}</strong></div>
            <div><span>{t("reports.metric.paidBills")}</span><strong>{formatNumber(row.paidBills)}</strong></div>
          </div>
        )}

        {row.type === "product-profit" && (
          <>
            <div className={styles.drawerSummary}>
              <div><span>{t("reports.metric.productSales")}</span><strong>{money(row.productSales)}</strong></div>
              <div><span>{t("reports.metric.cost")}</span><strong>{money(row.cost)}</strong></div>
              <div><span>{t("reports.metric.grossDifference")}</span><strong>{money(row.grossDifference)}</strong></div>
              <div><span>{t("reports.metric.marginPercent")}</span><strong>{row.marginPercent === null ? unavailable : `${formatNumber(row.marginPercent, { maximumFractionDigits: 2 })}%`}</strong></div>
            </div>
            {!row.hasCompleteCost && <div className={styles.drawerNotice}>{t("reports.costMissingHint")}</div>}
          </>
        )}

        {(row.type === "product-sales" || row.type === "product-profit") && (
          <section className={styles.drawerLines}>
            <h3>{t("reports.contributingLines")}</h3>
            {row.contributions.map((line, index) => (
              <div key={`${line.saleId}-${line.productId}-${line.packLabel}-${index}`} className={styles.drawerLine}>
                <div><strong>{line.billNo}</strong><small>{formatDate(line.soldAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
                <span>{formatNumber(line.quantity, { maximumFractionDigits: 3 })}</span>
                <span>{money(line.productSales)}</span>
                {row.type === "product-profit" && <span>{line.unitCost === null ? unavailable : money(line.unitCost * line.quantity)}</span>}
              </div>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}
