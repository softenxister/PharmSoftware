"use client";

import { Check, PackageCheck } from "lucide-react";
import styles from "@/app/purchase/PurchaseEntry.module.css";
import type { UploadedRow } from "@/app/purchase/purchaseData";
import { money } from "@/app/purchase/purchaseUtils";

interface PurchaseItemsTableProps {
  rows: UploadedRow[];
  saved: boolean;
  total: number;
  onSave: () => void;
}

export function PurchaseItemsTable({ rows, saved, total, onSave }: PurchaseItemsTableProps) {
  return (
    <section className={styles.tablePanel}>
      <div className={styles.tableHeader}>
        <div>
          <h2 className={styles.tableTitle}>Uploaded CSV Items</h2>
          <p className={styles.tableSubtitle}>Review matched item names and prices before saving this bill to stock.</p>
        </div>
        <div className={styles.lineCountBadge}>
          <PackageCheck size={14} />
          {rows.length} lines
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHeadRow}>
              <th className={styles.th}>CSV Item Name</th>
              <th className={styles.th}>Item Name</th>
              <th className={styles.th}>Lot No.</th>
              <th className={styles.th}>Exp. Date</th>
              <th className={`${styles.th} ${styles.textRight}`}>Price</th>
              <th className={`${styles.th} ${styles.textRight}`}>Sell</th>
              <th className={`${styles.th} ${styles.textRight}`}>Amount</th>
              <th className={`${styles.th} ${styles.textRight}`}>Free</th>
              <th className={`${styles.th} ${styles.textRight}`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const amount = Number(row.dist) * row.qty;
              return (
                <tr
                  key={row.lot}
                  className={`${styles.tableRow} ${index % 2 === 0 ? "" : styles.tableRowAlt}`}
                >
                  <td className={`${styles.td} ${styles.tdMuted}`}>{row.csv}</td>
                  <td className={`${styles.td} ${styles.tdStrong}`}>{row.item}</td>
                  <td className={styles.td}>{row.lot}</td>
                  <td className={styles.td}>{row.exp}</td>
                  <td className={`${styles.td} ${styles.tdMoney} ${styles.textRight}`}>{money(Number(row.dist))}</td>
                  <td className={`${styles.td} ${styles.tdMoney} ${styles.textRight}`}>{money(Number(row.retail))}</td>
                  <td className={`${styles.td} ${styles.tdMoney} ${styles.textRight}`}>{row.qty}</td>
                  <td className={`${styles.td} ${styles.tdFree} ${styles.textRight}`}>{row.free}</td>
                  <td className={`${styles.td} ${styles.tdTotal} ${styles.textRight}`}>{money(amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFooter}>
        <div>
          <p className={styles.totalLabel}>Bill total</p>
          <p className={styles.totalValue}>{money(total)}</p>
        </div>
        <button type="button" onClick={onSave} className={styles.saveButton}>
          {saved ? <Check size={16} /> : <PackageCheck size={16} />}
          {saved ? "Saved to stock" : "Save bill to stock"}
        </button>
      </div>
    </section>
  );
}
