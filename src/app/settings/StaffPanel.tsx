"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Search, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound, X } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import styles from "./Settings.module.css";

type StaffAccount = {
  id: string;
  name: string;
  username: string;
  phone: string;
  pharmacistLicenseNumber: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type Modal =
  | { type: "add" }
  | { type: "reset"; staff: StaffAccount }
  | { type: "status"; staff: StaffAccount }
  | null;

export function StaffPanel() {
  const { t, formatDate } = usePreferences();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const data = await response.json() as { error?: string; staff?: StaffAccount[] };
      if (!response.ok) throw new Error(data.error || t("staff.loadError"));
      setStaff(data.staff || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("staff.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-US");
    if (!query) return staff;
    return staff.filter((account) => [account.name, account.username, account.phone, account.pharmacistLicenseNumber || ""]
      .some((value) => value.toLocaleLowerCase("en-US").includes(query)));
  }, [search, staff]);

  const submitModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      let method = "PATCH";
      let payload: Record<string, unknown>;
      if (modal.type === "add") {
        method = "POST";
        const password = String(form.get("password") || "");
        if (password !== String(form.get("confirmPassword") || "")) throw new Error(t("staff.temporaryMismatch"));
        payload = {
          name: String(form.get("name") || ""), username: String(form.get("username") || ""),
          phone: String(form.get("phone") || ""), pharmacistLicenseNumber: String(form.get("license") || ""), password,
        };
      } else if (modal.type === "reset") {
        const password = String(form.get("password") || "");
        if (password !== String(form.get("confirmPassword") || "")) throw new Error(t("staff.temporaryMismatch"));
        payload = { staffId: modal.staff.id, action: "reset-password", password };
      } else {
        payload = { staffId: modal.staff.id, action: "set-active", isActive: !modal.staff.isActive };
      }
      const response = await fetch("/api/staff", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("staff.updateError"));
      setModal(null);
      await load();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("staff.updateError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>{t("settings.staff")}</h2><p className={styles.panelDescription}>{t("staff.description")}</p></div>
        <button type="button" className={`${styles.primaryButton} ${styles.createActionButton}`} onClick={() => { setError(""); setModal({ type: "add" }); }}><Plus size={15} />{t("staff.add")}</button>
      </div>
      <div className={styles.staffBody}>
        <div className={styles.ownerOnlyNotice}><ShieldCheck size={16} /><span><strong>{t("staff.ownerOnly")}</strong> {t("staff.ownerOnlyHint")}</span></div>
        <div className={styles.staffToolbar}>
          <label className={styles.searchControl}><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("staff.search")} aria-label={t("staff.searchLabel")} /></label>
          <span>{t("staff.count", { count: staff.length })}</span>
        </div>
        {error && !modal && <div className={styles.formError} role="alert">{error}</div>}
        <div className={styles.staffTable} role="table" aria-label={t("staff.accounts")}>
          <div className={styles.staffTableHead} role="row"><span>{t("staff.pharmacist")}</span><span>{t("staff.contact")}</span><span>{t("staff.access")}</span><span>{t("staff.lastLogin")}</span><span>{t("staff.actions")}</span></div>
          {loading ? <div className={styles.tableState}>{t("staff.loading")}</div> : filtered.length === 0 ? (
            <div className={styles.tableState}><UsersRound size={25} /><strong>{staff.length ? t("staff.noMatch") : t("staff.none")}</strong><span>{staff.length ? t("staff.noMatchHint") : t("staff.noneHint")}</span></div>
          ) : filtered.map((account) => (
            <div className={styles.staffRow} role="row" key={account.id}>
              <span className={styles.staffIdentity}><span className={styles.miniAvatar}>{account.name.slice(0, 2).toUpperCase()}</span><span><strong>{account.name}</strong><small>@{account.username}{account.pharmacistLicenseNumber ? ` · ${account.pharmacistLicenseNumber}` : ""}</small></span></span>
              <span className={styles.cellText}>{account.phone || "—"}</span>
              <span><span className={`${styles.statusBadge} ${account.isActive ? styles.statusActive : styles.statusInactive}`}>{account.isActive ? t("staff.active") : t("staff.inactive")}</span>{account.mustChangePassword && <small className={styles.passwordPending}>{t("staff.changeRequired")}</small>}</span>
              <span className={styles.cellText}>{account.lastLoginAt ? formatDate(account.lastLoginAt, { dateStyle: "medium", timeStyle: "short" }) : t("staff.never")}</span>
              <span className={styles.rowActions}><button type="button" onClick={() => { setError(""); setModal({ type: "reset", staff: account }); }} title={t("staff.resetTemporary")}><KeyRound size={15} />{t("staff.reset")}</button><button type="button" onClick={() => { setError(""); setModal({ type: "status", staff: account }); }} className={account.isActive ? styles.dangerText : styles.activateText}>{account.isActive ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}{account.isActive ? t("staff.deactivate") : t("staff.activate")}</button></span>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.settingsModal} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
            <div className={styles.modalHeader}><div><h3 id="staff-modal-title">{modal.type === "add" ? t("staff.add") : modal.type === "reset" ? t("staff.resetTemporary") : t("staff.accountAction", { action: modal.staff.isActive ? t("staff.deactivate") : t("staff.activate") })}</h3><p>{modal.type === "add" ? t("staff.addHint") : modal.type === "reset" ? t("staff.resetHint", { name: modal.staff.name }) : t(modal.staff.isActive ? "staff.deactivateHint" : "staff.activateHint", { name: modal.staff.name })}</p></div><button type="button" onClick={() => setModal(null)} aria-label={t("staff.close")}><X size={18} /></button></div>
            <form onSubmit={submitModal} className={styles.modalForm}>
              {modal.type === "add" && <><div className={styles.liveFormGrid}><label className={styles.liveField}><span>{t("account.fullName")}</span><input name="name" minLength={2} maxLength={100} required autoFocus /></label><label className={styles.liveField}><span>{t("account.username")}</span><input name="username" minLength={3} maxLength={32} required spellCheck={false} /></label><label className={styles.liveField}><span>{t("account.phone")} <small>{t("account.optional")}</small></span><input name="phone" maxLength={30} /></label><label className={styles.liveField}><span>{t("account.license")} <small>{t("account.optional")}</small></span><input name="license" maxLength={80} /></label></div><div className={styles.liveFormGrid}><label className={styles.liveField}><span>{t("staff.temporaryPassword")}</span><input name="password" type="password" minLength={10} maxLength={128} required /></label><label className={styles.liveField}><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type="password" minLength={10} maxLength={128} required /></label></div><div className={styles.temporaryNote}>{t("staff.firstSignIn")}</div></>}
              {modal.type === "reset" && <div className={styles.liveFormGrid}><label className={styles.liveField}><span>{t("staff.newTemporaryPassword")}</span><input name="password" type="password" minLength={10} maxLength={128} required autoFocus /></label><label className={styles.liveField}><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type="password" minLength={10} maxLength={128} required /></label></div>}
              {modal.type === "status" && <div className={styles.confirmBox}>{modal.staff.isActive ? t("staff.blockHint") : t("staff.restoreHint")}</div>}
              {error && <div className={styles.formError} role="alert">{error}</div>}
              <div className={styles.modalActions}><button type="button" className={styles.secondaryActionButton} onClick={() => setModal(null)}>{t("staff.cancel")}</button><button type="submit" className={`${styles.primaryButton} ${modal.type === "add" ? styles.createActionButton : ""} ${modal.type === "status" && modal.staff.isActive ? styles.dangerButton : ""}`} disabled={submitting}>{submitting ? t("common.saving") : modal.type === "add" ? t("staff.createAccount") : modal.type === "reset" ? t("staff.resetPassword") : modal.staff.isActive ? t("staff.deactivate") : t("staff.activate")}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
