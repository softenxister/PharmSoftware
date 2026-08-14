import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  filterMembers,
  nextMemberSort,
  sortMembers,
  type MemberRecord,
  type MemberSort,
} from "./memberData";
import {
  formatThaiPhoneNumberList,
} from "@/lib/thaiPhoneNumber";
import { MemberAvatar } from "@/components/member/MemberAvatar";
import { MemberProfileDialog } from "./detail/MemberProfileDialog";
import { useMemberCreate } from "./useMemberCreate";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, formatDate, formatMoney } = usePreferences();
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>(initialSort);
  const creator = useMemberCreate((member) => {
    setMembers((current) => [...current, member]);
    navigate(`/member/${encodeURIComponent(member.id)}`);
  });
  const visibleMembers = useMemo(
    () => sortMembers(filterMembers(members, query), sort),
    [members, query, sort],
  );
  const totalMemberPurchase = members.reduce((sum, member) => sum + member.totalPurchase, 0);
  const membersWithoutPurchases = members.filter((member) => !member.lastOrderAt).length;
  const createRequested = searchParams.get("create") === "1";

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
    if (createRequested) creator.beginCreate();
  }, [createRequested, creator.beginCreate]);

  const closeCreate = () => {
    creator.cancel();
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
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
                    <td><span className={styles.mobileValue}>{formatThaiPhoneNumberList(member.mobile)}</span></td>
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

      {creator.editor && (
        <MemberProfileDialog
          memberName=""
          editor={{ ...creator.editor, cancel: closeCreate }}
          mode="create"
        />
      )}
    </div>
  );
}
