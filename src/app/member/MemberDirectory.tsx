"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router";
import { usePreferences } from "@/app/PreferencesProvider";
import {
  filterMembers,
  nextMemberSort,
  sortMembers,
  type MemberRecord,
  type MemberSort,
} from "./memberData";
import {
  formatThaiPhoneInput,
  formatThaiPhoneNumber,
  isValidThaiPhoneNumber,
  shouldShowThaiPhoneValidationError,
} from "@/lib/thaiPhoneNumber";
import { MemberAvatar } from "./MemberAvatarView";
import styles from "./MemberDirectory.module.css";

const initialSort: MemberSort = { key: "lastOrderAt", direction: "desc" };

function SortIcon({ active, direction }: { active: boolean; direction: MemberSort["direction"] }) {
  if (!active) return <ChevronsUpDown size={14} aria-hidden="true" />;
  return direction === "asc"
    ? <ArrowUp size={14} aria-hidden="true" />
    : <ArrowDown size={14} aria-hidden="true" />;
}

export function MemberDirectory() {
  const navigate = useNavigate();
  const { t, formatDate, formatMoney } = usePreferences();
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>(initialSort);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const visibleMembers = useMemo(
    () => sortMembers(filterMembers(members, query), sort),
    [members, query, sort],
  );
  const totalMemberPurchase = members.reduce((sum, member) => sum + member.totalPurchase, 0);
  const membersWithoutPurchases = members.filter((member) => !member.lastOrderAt).length;
  const mobileValid = isValidThaiPhoneNumber(mobile);
  const showMobileError = shouldShowThaiPhoneValidationError(mobile);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/members", { cache: "no-store" });
        const data = await response.json() as { members?: MemberRecord[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("member.loadError"));
        if (!cancelled) setMembers(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t("member.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    if (createOpen) window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [createOpen]);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setName("");
    setMobile("");
    setCreateError("");
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !mobileValid || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, mobile }),
      });
      const data = await response.json() as { member?: MemberRecord; error?: string };
      if (!response.ok || !data.member) throw new Error(data.error || t("member.createError"));
      setMembers((current) => [...current, data.member as MemberRecord]);
      setCreateOpen(false);
      setName("");
      setMobile("");
      navigate(`/member/${encodeURIComponent(data.member.id)}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t("member.createError"));
    } finally {
      setCreating(false);
    }
  };

  const openMember = (memberId: string) => navigate(`/member/${encodeURIComponent(memberId)}`);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, memberId: string) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openMember(memberId);
  };

  const sortHeader = (key: MemberSort["key"], label: string) => (
    <button
      type="button"
      className={styles.sortButton}
      onClick={() => setSort((current) => nextMemberSort(current, key))}
      aria-label={t("member.sortBy", { label })}
    >
      <span>{label}</span>
      <SortIcon active={sort.key === key} direction={sort.direction} />
    </button>
  );

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <section className={styles.overview} aria-labelledby="member-page-title">
          <header className={styles.header}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{t("member.directory")}</p>
              <h1 id="member-page-title" className={styles.title}>{t("member.members")}</h1>
            </div>
            <button type="button" className={styles.createButton} onClick={() => setCreateOpen(true)}>
              <Plus size={17} aria-hidden="true" />
              {t("member.create")}
            </button>
          </header>

          <div className={styles.summaryGrid} aria-label={t("member.memberSummary")}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t("member.members")}</span>
              <strong className={styles.metricValue}>{members.length}</strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t("member.totalPurchase")}</span>
              <strong className={styles.metricValue}>฿{formatMoney(totalMemberPurchase)}</strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t("member.noPurchases")}</span>
              <strong className={`${styles.metricValue} ${styles.metricPending}`}>{membersWithoutPurchases}</strong>
            </div>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="member-table-title">
          <div className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              <div className={styles.panelTitleRow}>
                <h2 id="member-table-title" className={styles.panelTitle}>{t("member.list")}</h2>
              </div>
              <p className={styles.panelMeta}>{t("member.count", { visible: visibleMembers.length, total: members.length })}</p>
            </div>

            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>{t("member.searchLabel")}</span>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("member.search")}
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
                    {sortHeader("name", t("member.customerName"))}
                  </th>
                  <th>{t("member.mobile")}</th>
                  <th aria-sort={sort.key === "registeredAt" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {sortHeader("registeredAt", t("member.registered"))}
                  </th>
                  <th aria-sort={sort.key === "lastOrderAt" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {sortHeader("lastOrderAt", t("member.lastOrder"))}
                  </th>
                  <th>{t("member.totalPurchase")}</th>
                  <th aria-label={t("member.actions")} />
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={styles.memberRow}
                    tabIndex={0}
                    role="link"
                    aria-label={t("member.open", { name: member.name })}
                    onClick={() => openMember(member.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, member.id)}
                  >
                    <td>
                      <div className={styles.customerCell}>
                        <MemberAvatar
                          name={member.name}
                          avatarUrl={member.avatarUrl}
                          className={`${styles.avatar} ${styles[`avatar${Number(member.id.slice(-1)) % 4}`]}`}
                        />
                        <span className={styles.customerName} title={member.name}>{member.name}</span>
                      </div>
                    </td>
                    <td><span className={styles.mobileValue}>{formatThaiPhoneNumber(member.mobile)}</span></td>
                    <td><time dateTime={member.registeredAt}>{formatDate(member.registeredAt)}</time></td>
                    <td>{member.lastOrderAt
                      ? <time dateTime={member.lastOrderAt}>{formatDate(member.lastOrderAt)}</time>
                      : <span className={styles.noPurchase}>{t("member.noPurchases")}</span>}</td>
                    <td><span className={styles.purchaseValue}>฿{formatMoney(member.totalPurchase)}</span></td>
                    <td className={styles.rowAction} aria-hidden="true"><ChevronRight size={17} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && <div className={styles.emptyState} role="status">{t("common.loading")}</div>}
            {!loading && loadError && (
              <div className={styles.emptyState} role="alert">
                <strong>{t("member.loadError")}</strong>
                <span>{loadError}</span>
              </div>
            )}
            {!loading && !loadError && visibleMembers.length === 0 && (
              <div className={styles.emptyState} role="status">
                <strong>{t("member.none")}</strong>
                <span>{t("member.noneHint")}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {createOpen && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onKeyDown={(event) => { if (event.key === "Escape") closeCreate(); }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate(); }}
        >
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="create-member-title">
            <div className={styles.dialogHeader}>
              <div>
                <p className={styles.dialogEyebrow}>{t("member.directory")}</p>
                <h2 id="create-member-title">{t("member.create")}</h2>
              </div>
              <button type="button" className={styles.iconButton} onClick={closeCreate} aria-label={t("member.closeCreate")}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={submitCreate} className={styles.memberForm}>
              <label>
                <span>{t("member.customerName")}</span>
                <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
              </label>
              <label>
                <span>{t("member.mobile")}</span>
                <input
                  value={mobile}
                  onChange={(event) => setMobile(formatThaiPhoneInput(event.target.value))}
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={12}
                  placeholder="081-234-5678"
                  aria-describedby={showMobileError ? "create-member-mobile-error" : undefined}
                  aria-invalid={showMobileError}
                  required
                />
              </label>
              {showMobileError && (
                <p id="create-member-mobile-error" className={styles.formError} role="alert">
                  {t("member.mobileInvalid")}
                </p>
              )}
              <p className={styles.formHint}>{t("member.createHint")}</p>
              {createError && <p className={styles.formError} role="alert">{createError}</p>}
              <div className={styles.dialogActions}>
                <button type="button" className={styles.cancelButton} onClick={closeCreate}>{t("member.cancel")}</button>
                <button type="submit" className={`${styles.saveButton} ${styles.createActionButton}`} disabled={!name.trim() || !mobileValid || creating}>
                  {creating ? t("common.saving") : t("member.create")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
