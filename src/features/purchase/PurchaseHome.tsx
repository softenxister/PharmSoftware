import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  isEditablePurchaseBillRow,
  isPurchaseBillRowActivationKey,
  type PurchaseBillStatus,
} from "./purchaseRowInteraction";
import styles from "./PurchaseHome.module.css";

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
        <section className={styles.overview} aria-labelledby="purchase-page-title">
          <header className={styles.header}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{t("purchase.counter")}</p>
              <h1 id="purchase-page-title" className={styles.title}>{t("purchase.bills")}</h1>
            </div>
          </header>

          <div className={styles.summaryGrid} aria-label={t("purchase.summary")}>
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
              <strong className={`${styles.metricValue} ${styles.metricPending}`}>
                {purchaseBills.filter((bill) => bill.status !== "received").length}
              </strong>
            </div>
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
                aria-label={t("purchase.search")}
                placeholder={t("purchase.search")}
              />
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col className={styles.billColumn} />
                <col className={styles.invoiceColumn} />
                <col className={styles.distributorColumn} />
                <col className={styles.itemsColumn} />
                <col className={styles.qtyColumn} />
                <col className={styles.totalColumn} />
                <col className={styles.statusColumn} />
              </colgroup>
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
                {visibleBills.map((bill) => {
                  const isEditableRow = isEditablePurchaseBillRow(bill.status);
                  const openBill = () => navigate(`/purchase/new?id=${encodeURIComponent(bill.id)}`);
                  const billLabel = t(
                    bill.status === "received" ? "purchase.viewCompleted" : "purchase.open",
                    { bill: bill.billNo },
                  );
                  const billContent = (
                    <>
                      <span className={styles.billNo}>{bill.billNo}</span>
                      <span className={styles.billDate}>
                        {formatDate(bill.date, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </>
                  );

                  return (
                    <tr
                      key={bill.id}
                      className={isEditableRow ? styles.editableRow : undefined}
                      tabIndex={isEditableRow ? 0 : undefined}
                      aria-label={isEditableRow ? billLabel : undefined}
                      onClick={() => {
                        if (isEditableRow) openBill();
                      }}
                      onKeyDown={(event) => {
                        if (
                          !isEditableRow
                          || event.target !== event.currentTarget
                          || !isPurchaseBillRowActivationKey(event.key)
                        ) return;
                        event.preventDefault();
                        openBill();
                      }}
                    >
                      <td>
                        <div className={styles.billCell}>
                          {isEditableRow ? (
                            <span className={styles.billLink}>{billContent}</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.billLink}
                              aria-label={billLabel}
                              onClick={openBill}
                            >
                              {billContent}
                            </button>
                          )}
                        </div>
                      </td>
                      <td><span className={styles.cellText} title={bill.invoiceNo}>{bill.invoiceNo}</span></td>
                      <td><span className={styles.cellText} title={bill.distributor}>{bill.distributor}</span></td>
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
                  );
                })}
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
