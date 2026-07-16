"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PackagePlus, Search } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
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

export function PurchaseHome() {
  const navigate = useNavigate();
  const { t, formatDate, formatMoney, formatNumber } = usePreferences();
  const statusLabel = (status: PurchaseBillStatus) => t(status === "received"
    ? "purchase.received"
    : status === "draft" ? "purchase.draft" : "purchase.partial");
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
      [bill.billNo, bill.invoiceNo, bill.distributor, statusLabel(bill.status)].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [purchaseBills, query, t]);

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
            <span>{t("purchase.new")}</span>
          </button>
          <div>
            <p className={styles.eyebrow}>{t("purchase.counter")}</p>
            <h1 className={styles.title}>{t("purchase.bills")}</h1>
          </div>
        </header>

        <section className={styles.summaryGrid} aria-label={t("purchase.summary")}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t("purchase.receivedValue")}</span>
            <strong className={styles.metricValue}>฿{formatMoney(receivedTotal)}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t("purchase.billCount")}</span>
            <strong className={styles.metricValue}>{purchaseBills.length}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t("purchase.draftReady")}</span>
            <strong className={styles.metricValue}>
              {purchaseBills.filter((bill) => bill.status !== "received").length}
            </strong>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{t("purchase.table")}</h2>
              <p className={styles.panelMeta}>{t("purchase.savedImmediately")}</p>
            </div>
            <label className={styles.searchField}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("purchase.search")}
              />
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("purchase.bill")}</th>
                  <th>{t("purchase.invoice")}</th>
                  <th>{t("purchase.distributor")}</th>
                  <th>{t("purchase.items")}</th>
                  <th>{t("purchase.qty")}</th>
                  <th className={styles.alignRight}>{t("purchase.netTotal")}</th>
                  <th>{t("purchase.status")}</th>
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
                          aria-label={t(bill.status === "received" ? "purchase.viewCompleted" : "purchase.open", { bill: bill.billNo })}
                          onClick={() => navigate(`/purchase/new?id=${encodeURIComponent(bill.id)}`)}
                        >
                          <span className={styles.billNo}>{bill.billNo}</span>
                          <span className={styles.billDate}>{formatDate(bill.date, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                      </div>
                    </td>
                    <td>{bill.invoiceNo}</td>
                    <td>{bill.distributor}</td>
                    <td>{bill.itemCount}</td>
                    <td>{formatNumber(bill.totalQty)}</td>
                    <td className={styles.alignRight}>
                      <span className={styles.amount}>฿{formatMoney(bill.netTotal)}</span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles[`status_${bill.status}`]}`}>
                        {statusLabel(bill.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!isLoading && visibleBills.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>{loadError ? t("purchase.loadError") : t("purchase.noBills")}</p>
                <p className={styles.emptyBody}>
                  {loadError ? t("purchase.loadErrorHint") : t("purchase.noBillsHint")}
                </p>
              </div>
            )}
            {isLoading && <div className={styles.emptyState} role="status">{t("purchase.loading")}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
