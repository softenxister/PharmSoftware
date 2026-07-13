"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, Users } from "lucide-react";
import {
  dummyMembers,
  filterMembers,
  nextMemberSort,
  sortMembers,
  type MemberSort,
} from "./memberData";
import styles from "./MemberDirectory.module.css";

const initialSort: MemberSort = { key: "lastOrderAt", direction: "desc" };

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBaht(value: number): string {
  return `฿${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SortIcon({ active, direction }: { active: boolean; direction: MemberSort["direction"] }) {
  if (!active) return <ChevronsUpDown size={14} aria-hidden="true" />;
  return direction === "asc"
    ? <ArrowUp size={14} aria-hidden="true" />
    : <ArrowDown size={14} aria-hidden="true" />;
}

export function MemberDirectory() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>(initialSort);
  const visibleMembers = useMemo(
    () => sortMembers(filterMembers(dummyMembers, query), sort),
    [query, sort],
  );

  const sortHeader = (key: MemberSort["key"], label: string) => (
    <button
      type="button"
      className={styles.sortButton}
      onClick={() => setSort((current) => nextMemberSort(current, key))}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <SortIcon active={sort.key === key} direction={sort.direction} />
    </button>
  );

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Customer directory</p>
          <h1 className={styles.title}>Members</h1>
        </header>

        <section className={styles.panel} aria-labelledby="member-table-title">
          <div className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              <div className={styles.panelTitleRow}>
                <Users size={17} aria-hidden="true" />
                <h2 id="member-table-title" className={styles.panelTitle}>Member list</h2>
              </div>
              <p className={styles.panelMeta}>{visibleMembers.length} of {dummyMembers.length} members</p>
            </div>

            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>Search members by name, mobile number, or address</span>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, mobile, or address"
              />
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col className={styles.customerColumn} />
                <col className={styles.mobileColumn} />
                <col className={styles.registeredColumn} />
                <col className={styles.lastOrderColumn} />
                <col className={styles.purchaseColumn} />
                <col className={styles.actionColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th aria-sort={sort.key === "name" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {sortHeader("name", "Customer name")}
                  </th>
                  <th>Mobile no.</th>
                  <th aria-sort={sort.key === "registeredAt" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {sortHeader("registeredAt", "Registration date")}
                  </th>
                  <th aria-sort={sort.key === "lastOrderAt" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {sortHeader("lastOrderAt", "Last order date")}
                  </th>
                  <th>Total purchase</th>
                  <th aria-label="Member actions" />
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className={styles.customerCell}>
                        <span className={`${styles.avatar} ${styles[`avatar${Number(member.id.slice(-1)) % 4}`]}`} aria-hidden="true">
                          {initials(member.name)}
                        </span>
                        <span className={styles.customerName} title={member.name}>{member.name}</span>
                      </div>
                    </td>
                    <td><span className={styles.mobileValue}>{member.mobile}</span></td>
                    <td><time dateTime={member.registeredAt}>{formatDate(member.registeredAt)}</time></td>
                    <td><time dateTime={member.lastOrderAt}>{formatDate(member.lastOrderAt)}</time></td>
                    <td><span className={styles.purchaseValue}>{formatBaht(member.totalPurchase)}</span></td>
                    <td aria-hidden="true" />
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleMembers.length === 0 && (
              <div className={styles.emptyState} role="status">
                <strong>No members found</strong>
                <span>Try a different name, mobile number, or address.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
