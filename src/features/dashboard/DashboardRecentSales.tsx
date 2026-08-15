import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import type { DashboardRecentSale } from "@server/db/dashboard/dashboardModel";
import type { TranslationKey, TranslationParams } from "@/i18n/i18n";
import styles from "./Dashboard.module.css";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function DashboardRecentSales({
  sales,
  formatDate,
  formatMoney,
  t,
}: {
  sales: DashboardRecentSale[];
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (value: number) => string;
  t: Translate;
}) {
  return (
    <section className={styles.panel} aria-labelledby="dashboard-recent-title">
      <header className={styles.panelHeader}>
        <div>
          <h2 id="dashboard-recent-title">{t("dashboard.recentSales")}</h2>
          <p>{t("dashboard.recentSalesSubtitle")}</p>
        </div>
        <Link to="/sales" className={styles.textLink}>{t("dashboard.viewAllSales")}</Link>
      </header>
      {sales.length === 0 ? (
        <div className={styles.compactEmpty}>{t("dashboard.noRecentSales")}</div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.salesTable}>
            <thead>
              <tr>
                <th>{t("dashboard.bill")}</th>
                <th>{t("dashboard.customer")}</th>
                <th>{t("dashboard.time")}</th>
                <th>{t("dashboard.status")}</th>
                <th>{t("dashboard.total")}</th>
                <th><span className={styles.visuallyHidden}>{t("dashboard.action")}</span></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const href = sale.status === "pending"
                  ? "/sales/new?billId=" + encodeURIComponent(sale.id)
                  : "/sales";
                return (
                  <tr key={sale.id}>
                    <td><strong>{sale.billNo}</strong></td>
                    <td>{sale.customerName || t("dashboard.walkIn")}</td>
                    <td>{formatDate(sale.soldAt, { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>
                      <span className={sale.status === "paid" ? styles.paidStatus : styles.pendingStatus}>
                        {t(sale.status === "paid" ? "dashboard.paid" : "dashboard.pending")}
                      </span>
                    </td>
                    <td className={styles.moneyCell}>{"฿" + formatMoney(sale.netTotal)}</td>
                    <td>
                      <Link to={href} className={styles.rowAction}>
                        {sale.status === "pending" ? t("dashboard.resume") : t("dashboard.openSale")}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
