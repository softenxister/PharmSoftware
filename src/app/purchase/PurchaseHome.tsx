"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PackagePlus, Search } from "lucide-react";
import styles from "./PurchaseHome.module.css";
import { purchaseStatusLabel } from "@/lib/purchaseWorkflow";

type PurchaseBillStatus = "received" | "draft" | "partial";

type PurchaseBill = {
  id: string;
  billNo: string;
  invoiceNo: string;
  date: string;
  distributor: string;
  itemCount: number;
  totalQty: number;
  netTotal: number;
  status: PurchaseBillStatus;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatBaht(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PurchaseHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [savedPurchaseBills, setSavedPurchaseBills] = useState<PurchaseBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPurchaseBills() {
      try {
        const response = await fetch("/api/purchase", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load purchase bills.");
        const data = await response.json() as { bills?: PurchaseBill[] };
        if (!cancelled && Array.isArray(data.bills)) setSavedPurchaseBills(data.bills);
      } catch (error) {
        console.error(error);
        if (!cancelled) setLoadError("Purchase bills could not be loaded.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPurchaseBills();
    return () => {
      cancelled = true;
    };
  }, []);

  const purchaseBills = savedPurchaseBills;

  const visibleBills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchaseBills;

    return purchaseBills.filter((bill) =>
      [bill.billNo, bill.invoiceNo, bill.distributor, purchaseStatusLabel[bill.status]].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [purchaseBills, query]);

  const receivedTotal = purchaseBills
    .filter((bill) => bill.status === "received")
    .reduce((sum, bill) => sum + bill.netTotal, 0);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.newPurchaseButton}
            onClick={() => navigate("/purchase/new")}
          >
            <PackagePlus size={18} />
            <span>New Purchase</span>
          </button>
          <div>
            <p className={styles.eyebrow}>Purchase counter</p>
            <h1 className={styles.title}>Purchase bills</h1>
          </div>
        </header>

        <section className={styles.summaryGrid} aria-label="Purchase summary">
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Received value</span>
            <strong className={styles.metricValue}>฿{formatBaht(receivedTotal)}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Bills</span>
            <strong className={styles.metricValue}>{purchaseBills.length}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Draft / Ready</span>
            <strong className={styles.metricValue}>
              {purchaseBills.filter((bill) => bill.status !== "received").length}
            </strong>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Purchase bill table</h2>
              <p className={styles.panelMeta}>Saved purchases appear here immediately.</p>
            </div>
            <label className={styles.searchField}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bill, invoice, distributor, or status"
              />
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Invoice</th>
                  <th>Distributor</th>
                  <th>Items</th>
                  <th>Qty</th>
                  <th className={styles.alignRight}>Net total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleBills.map((bill) => (
                  <tr key={bill.id}>
                    <td>
                      <div className={styles.billCell}>
                        <button
                          type="button"
                          className={styles.billLink}
                          aria-label={bill.status === "received" ? `View completed bill ${bill.billNo}` : `Open ${bill.billNo}`}
                          onClick={() => navigate(`/purchase/new?id=${encodeURIComponent(bill.id)}`)}
                        >
                          <span className={styles.billNo}>{bill.billNo}</span>
                          <span className={styles.billDate}>{formatDate(bill.date)}</span>
                        </button>
                      </div>
                    </td>
                    <td>{bill.invoiceNo}</td>
                    <td>{bill.distributor}</td>
                    <td>{bill.itemCount}</td>
                    <td>{bill.totalQty.toLocaleString("en-US")}</td>
                    <td className={styles.alignRight}>
                      <span className={styles.amount}>฿{formatBaht(bill.netTotal)}</span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles[`status_${bill.status}`]}`}>
                        {purchaseStatusLabel[bill.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!isLoading && visibleBills.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>{loadError || "No purchase bills match this search"}</p>
                <p className={styles.emptyBody}>
                  {loadError ? "Check the database connection and try again." : "Try a different bill number, invoice, or distributor."}
                </p>
              </div>
            )}
            {isLoading && <div className={styles.emptyState} role="status">Loading purchase bills...</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
