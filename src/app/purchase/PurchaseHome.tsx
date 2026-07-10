"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Search } from "lucide-react";
import styles from "./PurchaseHome.module.css";

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

const statusLabel: Record<PurchaseBillStatus, string> = {
  received: "Received",
  draft: "Draft",
  partial: "Partial",
};

const fakePurchaseBills: PurchaseBill[] = [
  {
    id: "po-001",
    billNo: "PB-20260708-001",
    invoiceNo: "INV-SMS-7881",
    date: "2026-07-08T09:24:00+07:00",
    distributor: "Siam Medical Supply",
    itemCount: 8,
    totalQty: 860,
    netTotal: 42850,
    status: "received",
  },
  {
    id: "po-002",
    billNo: "PB-20260707-004",
    invoiceNo: "TPD-260707-19",
    date: "2026-07-07T15:12:00+07:00",
    distributor: "TPD Thanom Pharma Distribution",
    itemCount: 5,
    totalQty: 412,
    netTotal: 19740,
    status: "partial",
  },
  {
    id: "po-003",
    billNo: "PB-20260707-003",
    invoiceNo: "BPD-55291",
    date: "2026-07-07T11:36:00+07:00",
    distributor: "Bangkok Pharma Distribution",
    itemCount: 11,
    totalQty: 1240,
    netTotal: 58120,
    status: "received",
  },
  {
    id: "po-004",
    billNo: "PB-20260706-002",
    invoiceNo: "DRAFT",
    date: "2026-07-06T17:05:00+07:00",
    distributor: "VORAMIT DRUG CENTER",
    itemCount: 3,
    totalQty: 188,
    netTotal: 9250,
    status: "draft",
  },
  {
    id: "po-005",
    billNo: "PB-20260706-001",
    invoiceNo: "BM-TH-66120",
    date: "2026-07-06T10:18:00+07:00",
    distributor: "Buymed Thailand",
    itemCount: 7,
    totalQty: 705,
    netTotal: 31490,
    status: "received",
  },
];

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [savedPurchaseBills, setSavedPurchaseBills] = useState<PurchaseBill[]>([]);

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
      }
    }

    void loadPurchaseBills();
    return () => {
      cancelled = true;
    };
  }, []);

  const purchaseBills = useMemo(() => {
    const savedIds = new Set(savedPurchaseBills.map((bill) => bill.id));
    return [
      ...savedPurchaseBills,
      ...fakePurchaseBills.filter((bill) => !savedIds.has(bill.id)),
    ];
  }, [savedPurchaseBills]);

  const visibleBills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchaseBills;

    return purchaseBills.filter((bill) =>
      [bill.billNo, bill.invoiceNo, bill.distributor, statusLabel[bill.status]].some((value) =>
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
            onClick={() => router.push("/purchase/new")}
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
            <span className={styles.metricLabel}>Draft / Partial</span>
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
                        <span className={styles.billNo}>{bill.billNo}</span>
                        <span className={styles.billDate}>{formatDate(bill.date)}</span>
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
                        {statusLabel[bill.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleBills.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No purchase bills match this search</p>
                <p className={styles.emptyBody}>Try a different bill number, invoice, or distributor.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
