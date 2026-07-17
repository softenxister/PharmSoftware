"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronRight,
  Edit3,
  ReceiptText,
  Search,
  ShieldAlert,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { shouldCloseDropdown } from "@/app/dropdownInteraction";
import { usePreferences } from "@/app/PreferencesProvider";
import { formatThaiPhoneInput, formatThaiPhoneNumber, isValidThaiPhoneNumber } from "@/lib/thaiPhoneNumber";
import { isAllowedMemberAvatarFile } from "../memberAvatar";
import { MemberAvatar } from "../MemberAvatarView";
import type { MemberRecord } from "../memberData";
import styles from "./MemberDetail.module.css";

type TransactionStatus = "paid" | "pending" | "void";

type IngredientOption = {
  id: string;
  canonicalName: string;
  thaiName?: string;
  aliases?: string[];
};

type MemberDetailRecord = MemberRecord & {
  paidTransactionCount: number;
  transactions: Array<{
    id: string;
    billNo: string;
    soldAt: string;
    status: TransactionStatus;
    itemCount: number;
    paymentMethod: string;
    purchaseMethod: string;
    netTotal: number;
    lines: Array<{
      id: string;
      itemName: string;
      packLabel: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>;
  purchasedItems: Array<{
    productId: string;
    itemName: string;
    totalQuantity: number;
    unit: string;
    purchaseCount: number;
    lastPurchasedAt: string;
  }>;
};

export function MemberDetail() {
  const { memberId = "" } = useParams();
  const navigate = useNavigate();
  const { t, formatDate, formatMoney, formatNumber } = usePreferences();
  const [member, setMember] = useState<MemberDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "items">("transactions");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");
  const [timeOrder, setTimeOrder] = useState<"desc" | "asc">("desc");
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<IngredientOption[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [ingredientOptionsOpen, setIngredientOptionsOpen] = useState(false);
  const [ingredientSearching, setIngredientSearching] = useState(false);
  const [ingredientSearchError, setIngredientSearchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const ingredientDropdownRef = useRef<HTMLDivElement>(null);
  const mobileValid = isValidThaiPhoneNumber(mobile);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIngredientSearching(true);
      setIngredientSearchError("");
      try {
        const response = await fetch(`/api/ingredients?q=${encodeURIComponent(ingredientQuery.trim())}`, { cache: "no-store" });
        const data = await response.json() as { ingredients?: IngredientOption[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("member.allergySearchError"));
        if (!cancelled) setIngredientOptions(Array.isArray(data.ingredients) ? data.ingredients : []);
      } catch (error) {
        if (!cancelled) setIngredientSearchError(error instanceof Error ? error.message : t("member.allergySearchError"));
      } finally {
        if (!cancelled) setIngredientSearching(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [editing, ingredientQuery, t]);

  useEffect(() => {
    if (!ingredientOptionsOpen) return;

    const closeIngredientOptionsOnOutsideClick = (event: PointerEvent) => {
      if (shouldCloseDropdown(ingredientDropdownRef.current, event.target as Node)) {
        setIngredientOptionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeIngredientOptionsOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeIngredientOptionsOnOutsideClick);
  }, [ingredientOptionsOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadMember() {
      setLoading(true);
      setLoadError("");
      setNotFound(false);
      try {
        const response = await fetch(`/api/members?memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" });
        const data = await response.json() as { member?: MemberDetailRecord; error?: string };
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok || !data.member) throw new Error(data.error || t("member.loadError"));
        if (!cancelled) {
          setMember(data.member);
          setName(data.member.name);
          setMobile(formatThaiPhoneNumber(data.member.mobile));
          setAvatarUrl(data.member.avatarUrl ?? null);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t("member.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMember();
    return () => { cancelled = true; };
  }, [memberId, t]);

  const transactions = useMemo(() => {
    if (!member) return [];
    return member.transactions
      .filter((transaction) => statusFilter === "all" || transaction.status === statusFilter)
      .sort((first, second) => {
        const comparison = new Date(first.soldAt).getTime() - new Date(second.soldAt).getTime();
        return timeOrder === "asc" ? comparison : -comparison;
      });
  }, [member, statusFilter, timeOrder]);

  const beginEdit = () => {
    if (!member) return;
    setName(member.name);
    setMobile(formatThaiPhoneNumber(member.mobile));
    setAvatarUrl(member.avatarUrl ?? null);
    setAvatarChanged(false);
    setAvatarError("");
    setSelectedAllergies(member.allergies);
    setIngredientQuery("");
    setIngredientOptions([]);
    setIngredientOptionsOpen(false);
    setIngredientSearchError("");
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setAvatarError("");
    setSaveError("");
  };

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAvatarError("");
    if (!file) return;
    if (!isAllowedMemberAvatarFile(file)) {
      setAvatarError(t("member.imageError"));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setAvatarChanged(true);
      }
    };
    reader.onerror = () => setAvatarError(t("member.imageError"));
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!member || saving || !name.trim() || !mobileValid) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          name,
          mobile,
          ...(avatarChanged ? { avatarUrl } : {}),
          allergyIngredientIds: selectedAllergies.map((ingredient) => ingredient.id),
        }),
      });
      const data = await response.json() as { member?: MemberRecord; error?: string };
      if (!response.ok || !data.member) throw new Error(data.error || t("member.updateError"));
      setMember((current) => current ? { ...current, ...data.member } : current);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("member.updateError"));
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status: TransactionStatus) => t(status === "paid"
    ? "sales.paid"
    : status === "pending" ? "sales.pendingPayment" : "sales.void");

  if (loading) return <div className={styles.statePage} role="status">{t("common.loading")}</div>;
  if (notFound) return (
    <div className={styles.statePage} role="alert">
      <UserRound size={32} aria-hidden="true" />
      <strong>{t("member.notFound")}</strong>
      <span>{t("member.notFoundHint")}</span>
      <button type="button" onClick={() => navigate("/member")}>{t("member.backToList")}</button>
    </div>
  );
  if (loadError || !member) return (
    <div className={styles.statePage} role="alert">
      <strong>{t("member.loadError")}</strong>
      <span>{loadError}</span>
      <button type="button" onClick={() => navigate("/member")}>{t("member.backToList")}</button>
    </div>
  );

  const profileUnchanged = name.trim() === member.name
    && formatThaiPhoneNumber(mobile) === formatThaiPhoneNumber(member.mobile)
    && avatarUrl === (member.avatarUrl ?? null)
    && selectedAllergies.map((ingredient) => ingredient.id).sort().join("|")
      === member.allergies.map((ingredient) => ingredient.id).sort().join("|");
  const availableIngredientOptions = ingredientOptions.filter((ingredient) => (
    !selectedAllergies.some((selected) => selected.id === ingredient.id)
  ));
  const visibleAvatarUrl = editing ? avatarUrl : member.avatarUrl;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/member")}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("member.backToList")}
        </button>

        <header className={styles.profileHeader}>
          <div className={styles.identity}>
            <MemberAvatar name={member.name} avatarUrl={visibleAvatarUrl} className={styles.avatar} />
            <div className={styles.identityText}>
              <p>{t("member.profile")}</p>
              <h1 title={member.name}>{member.name}</h1>
              <span>{formatThaiPhoneNumber(member.mobile)} · {t("member.memberId")}: {member.id}</span>
            </div>
          </div>
          <button type="button" className={styles.editButton} onClick={beginEdit}>
            <Edit3 size={16} aria-hidden="true" />
            {t("member.editProfile")}
          </button>
        </header>

        <section className={styles.summaryGrid} aria-label={t("member.memberSummary")}>
          <div className={styles.summaryCard}>
            <span>{t("member.rank")}</span>
            <strong className={styles.rankValue}>{member.membershipRank}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>{t("member.points")}</span>
            <strong>{formatNumber(member.points)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>{t("member.totalPurchase")}</span>
            <strong>฿{formatMoney(member.totalPurchase)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>{t("member.paidBills")}</span>
            <strong>{formatNumber(member.paidTransactionCount)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>{t("member.registered")}</span>
            <strong>{formatDate(member.registeredAt)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>{t("member.lastOrder")}</span>
            <strong>{member.lastOrderAt ? formatDate(member.lastOrderAt) : t("member.noPurchases")}</strong>
          </div>
        </section>

        <section className={styles.allergyPanel} aria-labelledby="member-allergies-title">
          <div className={styles.allergyPanelHeading}>
            <span className={styles.allergyPanelIcon}><ShieldAlert size={17} aria-hidden="true" /></span>
            <div>
              <h2 id="member-allergies-title">{t("member.drugAllergies")}</h2>
              <p>{t("member.drugAllergiesHint")}</p>
            </div>
          </div>
          <div className={styles.allergyList}>
            {member.allergies.length > 0 ? member.allergies.map((ingredient) => (
              <span key={ingredient.id} className={styles.allergyTag}>
                <strong>{ingredient.canonicalName}</strong>
                {ingredient.thaiName && <small>{ingredient.thaiName}</small>}
              </span>
            )) : <span className={styles.noAllergies}>{t("member.noDrugAllergies")}</span>}
          </div>
        </section>

        <section className={styles.historyPanel}>
          <div className={styles.tabs} role="tablist" aria-label={t("member.purchaseRecords")}>
            <button type="button" role="tab" aria-selected={activeTab === "transactions"} onClick={() => setActiveTab("transactions")}>
              <ReceiptText size={16} aria-hidden="true" /> {t("member.transactions")}
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "items"} onClick={() => setActiveTab("items")}>
              <ShoppingBag size={16} aria-hidden="true" /> {t("member.purchasedItems")}
            </button>
          </div>

          {activeTab === "transactions" ? (
            <>
              <div className={styles.tableToolbar}>
                <div className={styles.statusFilters} aria-label={t("sales.filterStatus")}>
                  {(["all", "paid", "pending", "void"] as const).map((status) => (
                    <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
                      {status === "all" ? t("sales.all") : statusLabel(status)}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.orderButton} onClick={() => setTimeOrder((current) => current === "desc" ? "asc" : "desc")}>
                  {timeOrder === "desc" ? <ArrowDown size={15} aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
                  {t(timeOrder === "desc" ? "member.newestFirst" : "member.oldestFirst")}
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th aria-label={t("sales.items")} /><th>{t("sales.bill")}</th><th>{t("member.dateTime")}</th><th>{t("sales.items")}</th><th>{t("sales.payment")}</th><th>{t("sales.netTotal")}</th><th>{t("sales.status")}</th></tr></thead>
                  <tbody>
                    {transactions.map((transaction) => {
                      const expanded = expandedTransaction === transaction.id;
                      return [
                        <tr key={transaction.id}>
                          <td><button type="button" className={styles.expandButton} onClick={() => setExpandedTransaction(expanded ? null : transaction.id)} aria-label={t(expanded ? "member.closeBill" : "member.expandBill", { bill: transaction.billNo })} aria-expanded={expanded}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
                          <td><strong className={styles.billNo}>{transaction.billNo}</strong></td>
                          <td><time dateTime={transaction.soldAt}>{formatDate(transaction.soldAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></td>
                          <td>{transaction.itemCount}</td>
                          <td>{transaction.paymentMethod}</td>
                          <td className={styles.amount}>฿{formatMoney(transaction.netTotal)}</td>
                          <td><span className={`${styles.status} ${styles[`status_${transaction.status}`]}`}>{statusLabel(transaction.status)}</span></td>
                        </tr>,
                        expanded ? (
                          <tr key={`${transaction.id}-lines`} className={styles.lineDetailRow}>
                            <td colSpan={7}>
                              <table className={styles.lineTable}>
                                <thead><tr><th>{t("member.item")}</th><th>{t("member.pack")}</th><th>{t("member.quantity")}</th><th>{t("member.unitPrice")}</th><th>{t("member.lineTotal")}</th></tr></thead>
                                <tbody>{transaction.lines.map((line) => <tr key={line.id}><td>{line.itemName}</td><td>{line.packLabel}</td><td>{formatNumber(line.quantity)}</td><td>฿{formatMoney(line.unitPrice)}</td><td>฿{formatMoney(line.lineTotal)}</td></tr>)}</tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
                {transactions.length === 0 && <div className={styles.emptyState}>{t("member.noTransactions")}</div>}
              </div>
            </>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.itemTable}`}>
                <thead><tr><th>{t("member.item")}</th><th>{t("member.quantityPurchased")}</th><th>{t("member.purchaseCount")}</th><th>{t("member.lastPurchased")}</th></tr></thead>
                <tbody>{member.purchasedItems.map((item) => <tr key={item.productId}><td><strong>{item.itemName}</strong></td><td>{formatNumber(item.totalQuantity)} {item.unit}</td><td>{formatNumber(item.purchaseCount)}</td><td>{formatDate(item.lastPurchasedAt)}</td></tr>)}</tbody>
              </table>
              {member.purchasedItems.length === 0 && <div className={styles.emptyState}>{t("member.noItems")}</div>}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className={styles.dialogBackdrop} role="presentation" onKeyDown={(event) => { if (event.key === "Escape") cancelEdit(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) cancelEdit(); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
            <div className={styles.dialogHeader}><div><p>{t("member.profile")}</p><h2 id="edit-member-title">{t("member.editProfile")}</h2></div></div>
            <form className={styles.editForm} onSubmit={saveProfile}>
              <div className={styles.avatarEditor}>
                <MemberAvatar
                  name={name || member.name}
                  avatarUrl={avatarUrl}
                  className={styles.avatarPreview}
                />
                <div className={styles.avatarCopy}>
                  <strong>{t("member.profilePhoto")}</strong>
                  <small id="member-photo-hint">{t("member.photoHint")}</small>
                </div>
                <label className={styles.photoButton}>
                  <Camera size={14} aria-hidden="true" />
                  {t("member.chooseImage")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-describedby="member-photo-hint"
                    onChange={selectAvatar}
                  />
                </label>
                {avatarUrl && (
                  <button type="button" className={styles.removePhotoButton} onClick={() => { setAvatarUrl(null); setAvatarChanged(true); setAvatarError(""); }}>
                    {t("member.removePhoto")}
                  </button>
                )}
                {avatarError && <p className={styles.avatarError} role="alert">{avatarError}</p>}
              </div>
              <label><span>{t("member.customerName")}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus /></label>
              <label>
                <span>{t("member.mobile")}</span>
                <input
                  value={mobile}
                  onChange={(event) => setMobile(formatThaiPhoneInput(event.target.value))}
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={12}
                  placeholder="081-234-5678"
                  aria-describedby="edit-member-mobile-hint"
                  aria-invalid={mobile.length > 0 && !mobileValid}
                  required
                />
              </label>
              <p id="edit-member-mobile-hint" className={styles.readOnlyNote}>{t("member.mobileHint")}</p>
              <div className={styles.allergyEditor}>
                <div className={styles.allergyEditorLabel}>
                  <span>{t("member.drugAllergies")}</span>
                  <small>{t("member.allergySelectHint")}</small>
                </div>
                {selectedAllergies.length > 0 && (
                  <div className={styles.selectedAllergies} aria-label={t("member.selectedAllergies")}>
                    {selectedAllergies.map((ingredient) => (
                      <span key={ingredient.id} className={styles.selectedAllergyTag}>
                        <span>{ingredient.canonicalName}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAllergies((current) => current.filter((item) => item.id !== ingredient.id))}
                          aria-label={t("member.removeAllergy", { name: ingredient.canonicalName })}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div ref={ingredientDropdownRef}>
                  <div className={styles.ingredientCombobox}>
                    <Search size={15} aria-hidden="true" />
                    <input
                      id="member-allergy-search"
                      type="search"
                      value={ingredientQuery}
                      onChange={(event) => {
                        setIngredientQuery(event.target.value);
                        setIngredientOptionsOpen(true);
                      }}
                      onFocus={() => setIngredientOptionsOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setIngredientOptionsOpen(false);
                      }}
                      placeholder={t("member.searchIngredients")}
                      autoComplete="off"
                      role="combobox"
                      aria-haspopup="listbox"
                      aria-expanded={ingredientOptionsOpen}
                      aria-controls="member-allergy-options"
                    />
                  </div>
                  {ingredientOptionsOpen && (
                    <div id="member-allergy-options" className={styles.ingredientOptions} role="listbox" aria-label={t("member.ingredientResults")}>
                      {ingredientSearching && <span className={styles.ingredientState}>{t("common.loading")}</span>}
                      {!ingredientSearching && ingredientSearchError && <span className={styles.ingredientState} role="alert">{ingredientSearchError}</span>}
                      {!ingredientSearching && !ingredientSearchError && availableIngredientOptions.map((ingredient) => (
                        <button
                          key={ingredient.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => {
                            setSelectedAllergies((current) => [...current, ingredient]);
                            setIngredientQuery("");
                            setIngredientOptionsOpen(false);
                          }}
                        >
                          <strong>{ingredient.canonicalName}</strong>
                          <span>{ingredient.thaiName || ingredient.aliases?.slice(0, 2).join(" · ") || t("member.standardIngredient")}</span>
                        </button>
                      ))}
                      {!ingredientSearching && !ingredientSearchError && availableIngredientOptions.length === 0 && (
                        <span className={styles.ingredientState}>{t("member.noIngredients")}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className={styles.readOnlyNote}>{t("member.loyaltyReadOnly")}</p>
              {saveError && <p className={styles.formError} role="alert">{saveError}</p>}
              <div className={styles.dialogActions}><button type="button" onClick={cancelEdit}>{t("member.cancel")}</button><button type="submit" disabled={saving || !name.trim() || !mobileValid || profileUnchanged}>{saving ? t("common.saving") : t("member.saveChanges")}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
