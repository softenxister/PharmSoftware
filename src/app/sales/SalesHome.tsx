"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

/**
 * ── Mock data ──────────────────────────────────────────────────────────
 * Replace with a fetch to GET /api/sales?limit=… on mount.
 */
const MOCK_BILLS: RecentBill[] = [
  { id: 'b1', billNo: 'INV-240702-014', date: '2026-07-02T09:12:00', customerName: 'Suchada Wong', isMember: true, itemCount: 4, paymentMethod: 'Cash', purchaseMethod: 'pickup', netTotal: 386, status: 'paid' },
  { id: 'b2', billNo: 'INV-240702-013', date: '2026-07-02T08:47:00', customerName: 'Walk-in Customer', isMember: false, itemCount: 1, paymentMethod: 'PromptPay', purchaseMethod: 'pickup', netTotal: 45, status: 'paid' },
  { id: 'b3', billNo: 'INV-240701-041', date: '2026-07-01T18:03:00', customerName: 'Kridsada Phan', isMember: true, itemCount: 7, paymentMethod: 'Credit card', purchaseMethod: 'delivery', netTotal: 1240, status: 'pending' },
  { id: 'b4', billNo: 'INV-240701-040', date: '2026-07-01T17:22:00', customerName: 'Areeya Somboon', isMember: true, itemCount: 2, paymentMethod: 'Cash', purchaseMethod: 'pickup', netTotal: 128, status: 'paid' },
  { id: 'b5', billNo: 'INV-240701-039', date: '2026-07-01T15:55:00', customerName: 'Walk-in Customer', isMember: false, itemCount: 3, paymentMethod: 'PromptPay', purchaseMethod: 'pickup', netTotal: 210, status: 'void' },
  { id: 'b6', billNo: 'INV-240701-038', date: '2026-07-01T14:10:00', customerName: 'Natthapong Lee', isMember: true, itemCount: 5, paymentMethod: 'Cash', purchaseMethod: 'delivery', netTotal: 567, status: 'paid' },
];

const SAVED_SALES_KEY = 'pharm_recent_sales';

const STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  void: 'Void',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatBaht(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type StatusFilter = 'all' | BillStatus;

export default function SaleHome(): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bills, setBills] = useState<RecentBill[]>(MOCK_BILLS);

  useEffect(() => {
    const saved = window.localStorage.getItem(SAVED_SALES_KEY);
    if (!saved) return;

    try {
      const savedBills = JSON.parse(saved) as RecentBill[];
      setBills([...savedBills, ...MOCK_BILLS]);
    } catch {
      setBills(MOCK_BILLS);
    }
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

  const goToNewSale = () => router.push('/sales/new');

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Sales counter</p>
            <h1 className={styles.title}>Recent bills</h1>
          </div>
          <button
            type="button"
            className={styles.newSaleButton}
            onClick={goToNewSale}
            aria-label="Start a new sale"
            title="New sale"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7.5v9M7.5 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>New Sale</span>
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label="Sales summary">
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Paid sales</span>
            <strong className={styles.metricValue}>฿{formatBaht(totalSales)}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Paid bills</span>
            <strong className={styles.metricValue}>{paidCount}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Pending</span>
            <strong className={styles.metricValue}>{pendingCount}</strong>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Transactions</h2>
              <p className={styles.panelMeta}>Saved sales appear here immediately.</p>
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
                  placeholder="Search bill or customer"
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.statusChips} role="tablist" aria-label="Filter by status">
                {(['all', 'paid', 'pending', 'void'] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === s}
                    className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? 'All' : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                  <th className={styles.alignRight}>Net total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className={styles.row} tabIndex={0}>
                    <td>
                      <div className={styles.billCell}>
                        <span className={styles.billNo}>{bill.billNo}</span>
                        <span className={styles.billDate}>{formatDate(bill.date)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <span className={styles.avatar}>{initials(bill.customerName)}</span>
                        <div className={styles.customerMeta}>
                          <span className={styles.customerName}>{bill.customerName}</span>
                          {bill.isMember && <span className={styles.memberTag}>Member</span>}
                        </div>
                      </div>
                    </td>
                    <td>{bill.itemCount}</td>
                    <td>{bill.paymentMethod}</td>
                    <td className={styles.capitalize}>{bill.purchaseMethod}</td>
                    <td className={styles.alignRight}>
                      <span className={styles.amount}>฿{formatBaht(bill.netTotal)}</span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles[`status_${bill.status}`]}`}>
                        {STATUS_LABEL[bill.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredBills.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No bills match this search</p>
                <p className={styles.emptyBody}>Try a different bill number, customer name, or clear the status filter.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
