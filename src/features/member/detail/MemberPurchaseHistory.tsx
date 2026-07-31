import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type {
  MemberDetailRecord,
  TransactionStatus,
} from "./memberProfileTypes";
import styles from "./MemberDetail.module.css";

export function MemberPurchaseHistory({ member }: { member: MemberDetailRecord }) {
  const { t, formatDate, formatMoney, formatNumber } = usePreferences();
  const [activeTab, setActiveTab] = useState<"transactions" | "items">("transactions");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");
  const [timeOrder, setTimeOrder] = useState<"desc" | "asc">("desc");
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  const transactions = useMemo(() => member.transactions
    .filter(({ status }) => statusFilter === "all" || status === statusFilter)
    .sort((first, second) => {
      const comparison = new Date(first.soldAt).getTime() - new Date(second.soldAt).getTime();
      return timeOrder === "asc" ? comparison : -comparison;
    }), [member.transactions, statusFilter, timeOrder]);

  const statusLabel = (status: TransactionStatus) => t(
    status === "paid"
      ? "sales.paid"
      : status === "pending" ? "sales.pendingPayment" : "sales.void",
  );

  return (
    <section className={styles.historyPanel}>
      <div className={styles.tabs} role="tablist" aria-label={t("member.purchaseRecords")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "transactions"}
          onClick={() => setActiveTab("transactions")}
        >
          <ReceiptText size={16} aria-hidden="true" />
          {t("member.transactions")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "items"}
          onClick={() => setActiveTab("items")}
        >
          <ShoppingBag size={16} aria-hidden="true" />
          {t("member.purchasedItems")}
        </button>
      </div>

      {activeTab === "transactions" ? (
        <>
          <div className={styles.tableToolbar}>
            <div className={styles.statusFilters} aria-label={t("sales.filterStatus")}>
              {(["all", "paid", "pending", "void"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? t("sales.all") : statusLabel(status)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.orderButton}
              onClick={() => setTimeOrder((current) => current === "desc" ? "asc" : "desc")}
            >
              {timeOrder === "desc"
                ? <ArrowDown size={15} aria-hidden="true" />
                : <ArrowUp size={15} aria-hidden="true" />}
              {t(timeOrder === "desc" ? "member.newestFirst" : "member.oldestFirst")}
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label={t("sales.items")} />
                  <th>{t("sales.bill")}</th>
                  <th>{t("member.dateTime")}</th>
                  <th>{t("sales.items")}</th>
                  <th>{t("sales.payment")}</th>
                  <th>{t("sales.netTotal")}</th>
                  <th>{t("sales.status")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const expanded = expandedTransaction === transaction.id;
                  return (
                    <Fragment key={transaction.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className={styles.expandButton}
                            onClick={() => setExpandedTransaction(expanded ? null : transaction.id)}
                            aria-label={t(
                              expanded ? "member.closeBill" : "member.expandBill",
                              { bill: transaction.billNo },
                            )}
                            aria-expanded={expanded}
                          >
                            {expanded
                              ? <ChevronDown size={16} aria-hidden="true" />
                              : <ChevronRight size={16} aria-hidden="true" />}
                          </button>
                        </td>
                        <td><strong className={styles.billNo}>{transaction.billNo}</strong></td>
                        <td>
                          <time dateTime={transaction.soldAt}>
                            {formatDate(transaction.soldAt, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </td>
                        <td>{transaction.itemCount}</td>
                        <td>{transaction.paymentMethod}</td>
                        <td className={styles.amount}>฿{formatMoney(transaction.netTotal)}</td>
                        <td>
                          <span className={`${styles.status} ${styles[`status_${transaction.status}`]}`}>
                            {statusLabel(transaction.status)}
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className={styles.lineDetailRow}>
                          <td colSpan={7}>
                            <table className={styles.lineTable}>
                              <thead>
                                <tr>
                                  <th>{t("member.item")}</th>
                                  <th>{t("member.pack")}</th>
                                  <th>{t("member.quantity")}</th>
                                  <th>{t("member.unitPrice")}</th>
                                  <th>{t("member.lineTotal")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transaction.lines.map((line) => (
                                  <tr key={line.id}>
                                    <td>{line.itemName}</td>
                                    <td>{line.packLabel}</td>
                                    <td>{formatNumber(line.quantity)}</td>
                                    <td>฿{formatMoney(line.unitPrice)}</td>
                                    <td>฿{formatMoney(line.lineTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className={styles.emptyState}>{t("member.noTransactions")}</div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.itemTable}`}>
            <thead>
              <tr>
                <th>{t("member.item")}</th>
                <th>{t("member.quantityPurchased")}</th>
                <th>{t("member.purchaseCount")}</th>
                <th>{t("member.lastPurchased")}</th>
              </tr>
            </thead>
            <tbody>
              {member.purchasedItems.map((item) => (
                <tr key={item.productId}>
                  <td><strong>{item.itemName}</strong></td>
                  <td>{formatNumber(item.totalQuantity)} {item.unit}</td>
                  <td>{formatNumber(item.purchaseCount)}</td>
                  <td>{formatDate(item.lastPurchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {member.purchasedItems.length === 0 && (
            <div className={styles.emptyState}>{t("member.noItems")}</div>
          )}
        </div>
      )}
    </section>
  );
}
