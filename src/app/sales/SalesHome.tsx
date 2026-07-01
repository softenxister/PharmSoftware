import Link from "next/link";
import { CirclePlus } from "lucide-react";
import styles from "./SalesHome.module.css";
import { recentSales } from "./salesData";

const thb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function SalesHome() {
  const todayTotal = recentSales.reduce((sum, sale) => sum + sale.netPayableThb, 0);
  const totalItems = recentSales.reduce((sum, sale) => sum + sale.totalQuantity, 0);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Sales counter</p>
            <h1 className={styles.title}>Recent bills</h1>
          </div>
          <Link className={styles.newSaleButton} href="/sales/new">
            <CirclePlus size={18} />
            <span>New Sale</span>
          </Link>
        </div>

        <section className={styles.summaryGrid} aria-label="Sales summary">
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Today sales</div>
            <div className={styles.metricValue}>{thb.format(todayTotal)}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Transactions</div>
            <div className={styles.metricValue}>{recentSales.length}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Items sold</div>
            <div className={styles.metricValue}>{totalItems}</div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent sales transactions</h2>
            <span className={styles.panelMeta}>Latest counter activity</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Pharmacist</th>
                  <th>Payment</th>
                  <th>Qty</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className={styles.amount}>Net</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id}>
                    <td>
                      <div className={styles.billNo}>{sale.billNo}</div>
                    </td>
                    <td>
                      <div>{sale.billDate}</div>
                    </td>
                    <td>
                      <div>{sale.customerName}</div>
                    </td>
                    <td>
                      <span className={styles.muted}>{sale.pharmacistName}</span>
                    </td>
                    <td>{sale.paymentMethod}</td>
                    <td>{sale.totalQuantity}</td>
                    <td>{sale.uniqueItems}</td>
                    <td>
                      <span className={`${styles.status} ${styles[sale.status.toLowerCase()]}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className={styles.amount}>{thb.format(sale.netPayableThb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
