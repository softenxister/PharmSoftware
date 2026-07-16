"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePreferences } from '@/app/PreferencesProvider';
import styles from './SalesHome.module.css';

/**
 * ── Types ──────────────────────────────────────────────────────────────
 * Swap these for generated API types once the /sales endpoints exist.
 */
type BillStatus = 'paid' | 'pending' | 'void';
type PurchaseMethod = 'pickup' | 'delivery';

interface RecentBill {
  id: string;
  billNo: string;
  date: string; // ISO
  customerName: string;
  customerAvatar?: string;
  isMember: boolean;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: PurchaseMethod;
  netTotal: number;
  status: BillStatus;
}

const SAVED_SALES_KEY = 'pharm_recent_sales';

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type StatusFilter = 'all' | BillStatus;

export default function SaleHome({ initialStatus = 'all' }: { initialStatus?: StatusFilter }): React.ReactElement {
  const navigate = useNavigate();
  const { t, formatDate, formatMoney } = usePreferences();
  const statusLabel = (status: BillStatus) => t(status === 'paid'
    ? 'sales.paid'
    : status === 'pending' ? 'sales.pendingPayment' : 'sales.void');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [bills, setBills] = useState<RecentBill[]>([]);

  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    let cancelled = false;

    async function loadSales() {
      try {
        const response = await fetch('/api/sales', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load sales.');
        const data = await response.json() as { sales?: Array<RecentBill & { lines?: unknown[] }> };
        const sales = Array.isArray(data.sales) ? data.sales : [];
        if (!cancelled) {
          setBills(sales);
          window.localStorage.setItem(SAVED_SALES_KEY, JSON.stringify(sales.slice(0, 100)));
        }
      } catch {
        const saved = window.localStorage.getItem(SAVED_SALES_KEY);
        if (!saved || cancelled) return;
        try {
          setBills(JSON.parse(saved) as RecentBill[]);
        } catch {
          setBills([]);
        }
      }
    }

    void loadSales();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bills.filter((bill) => {
      const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        bill.billNo.toLowerCase().includes(q) ||
        bill.customerName.toLowerCase().includes(q)
      );
    });
  }, [bills, query, statusFilter]);

  const totalSales = bills
    .filter((bill) => bill.status === 'paid')
    .reduce((sum, bill) => sum + bill.netTotal, 0);
  const paidCount = bills.filter((bill) => bill.status === 'paid').length;
  const pendingCount = bills.filter((bill) => bill.status === 'pending').length;

  const goToNewSale = () => navigate('/sales/new');
  const openPendingBill = (bill: RecentBill) => {
    if (bill.status !== 'pending') return;
    navigate(`/sales/new?billId=${encodeURIComponent(bill.id)}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{t('sales.counter')}</p>
            <h1 className={styles.title}>{t('sales.recentBills')}</h1>
          </div>
          <button
            type="button"
            className={styles.newSaleButton}
            onClick={goToNewSale}
            aria-label={t('sales.startNew')}
            title={t('nav.newSale')}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7.5v9M7.5 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>{t('nav.newSale')}</span>
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label={t('sales.summary')}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t('sales.paidSales')}</span>
            <strong className={styles.metricValue}>฿{formatMoney(totalSales)}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t('sales.paidBills')}</span>
            <strong className={styles.metricValue}>{paidCount}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{t('sales.pending')}</span>
            <strong className={styles.metricValue}>{pendingCount}</strong>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{t('sales.transactions')}</h2>
              <p className={styles.panelMeta}>{t('sales.savedImmediately')}</p>
            </div>

            <div className={styles.toolbar}>
              <div className={styles.searchField}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.searchIcon}>
                  <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M20 20l-4.2-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('sales.search')}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.statusChips} role="tablist" aria-label={t('sales.filterStatus')}>
                {(['all', 'paid', 'pending', 'void'] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === s}
                    className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? t('sales.all') : statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('sales.bill')}</th>
                  <th>{t('sales.customer')}</th>
                  <th>{t('sales.items')}</th>
                  <th>{t('sales.payment')}</th>
                  <th>{t('sales.fulfilment')}</th>
                  <th className={styles.alignRight}>{t('sales.netTotal')}</th>
                  <th>{t('sales.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => {
                  const isPending = bill.status === 'pending';
                  return (
                    <tr
                      key={bill.id}
                      className={`${styles.row} ${isPending ? styles.rowPending : ''}`}
                      tabIndex={isPending ? 0 : undefined}
                      role={isPending ? 'button' : undefined}
                      aria-label={isPending ? `${t('sales.openPending')} ${bill.billNo}` : undefined}
                      title={isPending ? t('sales.openPending') : undefined}
                      onClick={() => openPendingBill(bill)}
                      onKeyDown={(e) => {
                        if (!isPending) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openPendingBill(bill);
                        }
                      }}
                    >
                    <td>
                      <div className={styles.billCell}>
                        <span className={styles.billNo}>{bill.billNo}</span>
                        <span className={styles.billDate}>{formatDate(bill.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <span className={styles.avatar}>{initials(bill.customerName)}</span>
                        <div className={styles.customerMeta}>
                          <span className={styles.customerName}>{bill.customerName}</span>
                          {bill.isMember && <span className={styles.memberTag}>{t('sales.member')}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{bill.itemCount}</td>
                    <td>{bill.paymentMethod}</td>
                    <td>{t(bill.purchaseMethod === 'pickup' ? 'sales.pickup' : 'sales.delivery')}</td>
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

            {filteredBills.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>{t('sales.noBills')}</p>
                <p className={styles.emptyBody}>{t('sales.noBillsHint')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
