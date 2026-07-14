"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Search, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound, X } from "lucide-react";
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

const formatLastLogin = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Never";

export function StaffPanel() {
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
      if (!response.ok) throw new Error(data.error || "Unable to load staff accounts.");
      setStaff(data.staff || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load staff accounts.");
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
        if (password !== String(form.get("confirmPassword") || "")) throw new Error("Temporary passwords do not match.");
        payload = {
          name: String(form.get("name") || ""), username: String(form.get("username") || ""),
          phone: String(form.get("phone") || ""), pharmacistLicenseNumber: String(form.get("license") || ""), password,
        };
      } else if (modal.type === "reset") {
        const password = String(form.get("password") || "");
        if (password !== String(form.get("confirmPassword") || "")) throw new Error("Temporary passwords do not match.");
        payload = { staffId: modal.staff.id, action: "reset-password", password };
      } else {
        payload = { staffId: modal.staff.id, action: "set-active", isActive: !modal.staff.isActive };
      }
      const response = await fetch("/api/staff", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update the staff account.");
      setModal(null);
      await load();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to update the staff account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>Staff</h2><p className={styles.panelDescription}>Create and control individual pharmacist access.</p></div>
        <button type="button" className={styles.primaryButton} onClick={() => { setError(""); setModal({ type: "add" }); }}><Plus size={15} />Add pharmacist</button>
      </div>
      <div className={styles.staffBody}>
        <div className={styles.ownerOnlyNotice}><ShieldCheck size={16} /><span><strong>Owner-only workspace</strong> Pharmacists cannot view or manage staff accounts.</span></div>
        <div className={styles.staffToolbar}>
          <label className={styles.searchControl}><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username, phone, or license" aria-label="Search staff" /></label>
          <span>{staff.length} pharmacist{staff.length === 1 ? "" : "s"}</span>
        </div>
        {error && !modal && <div className={styles.formError} role="alert">{error}</div>}
        <div className={styles.staffTable} role="table" aria-label="Pharmacist accounts">
          <div className={styles.staffTableHead} role="row"><span>Pharmacist</span><span>Contact</span><span>Access</span><span>Last login</span><span>Actions</span></div>
          {loading ? <div className={styles.tableState}>Loading staff accounts…</div> : filtered.length === 0 ? (
            <div className={styles.tableState}><UsersRound size={25} /><strong>{staff.length ? "No matching staff" : "No pharmacist accounts yet"}</strong><span>{staff.length ? "Try a different search." : "Add the first pharmacist to give them individual access."}</span></div>
          ) : filtered.map((account) => (
            <div className={styles.staffRow} role="row" key={account.id}>
              <span className={styles.staffIdentity}><span className={styles.miniAvatar}>{account.name.slice(0, 2).toUpperCase()}</span><span><strong>{account.name}</strong><small>@{account.username}{account.pharmacistLicenseNumber ? ` · ${account.pharmacistLicenseNumber}` : ""}</small></span></span>
              <span className={styles.cellText}>{account.phone || "—"}</span>
              <span><span className={`${styles.statusBadge} ${account.isActive ? styles.statusActive : styles.statusInactive}`}>{account.isActive ? "Active" : "Inactive"}</span>{account.mustChangePassword && <small className={styles.passwordPending}>Password change required</small>}</span>
              <span className={styles.cellText}>{formatLastLogin(account.lastLoginAt)}</span>
              <span className={styles.rowActions}><button type="button" onClick={() => { setError(""); setModal({ type: "reset", staff: account }); }} title="Reset temporary password"><KeyRound size={15} />Reset</button><button type="button" onClick={() => { setError(""); setModal({ type: "status", staff: account }); }} className={account.isActive ? styles.dangerText : styles.activateText}>{account.isActive ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}{account.isActive ? "Deactivate" : "Activate"}</button></span>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.settingsModal} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
            <div className={styles.modalHeader}><div><h3 id="staff-modal-title">{modal.type === "add" ? "Add pharmacist" : modal.type === "reset" ? "Reset temporary password" : `${modal.staff.isActive ? "Deactivate" : "Activate"} account`}</h3><p>{modal.type === "add" ? "Create individual sign-in access for a pharmacist." : modal.type === "reset" ? `${modal.staff.name} must change this password at the next login.` : `${modal.staff.name}${modal.staff.isActive ? " will be signed out on every device." : " will be allowed to sign in again."}`}</p></div><button type="button" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button></div>
            <form onSubmit={submitModal} className={styles.modalForm}>
              {modal.type === "add" && <><div className={styles.liveFormGrid}><label className={styles.liveField}><span>Full name</span><input name="name" minLength={2} maxLength={100} required autoFocus /></label><label className={styles.liveField}><span>Username</span><input name="username" minLength={3} maxLength={32} required spellCheck={false} /></label><label className={styles.liveField}><span>Phone <small>Optional</small></span><input name="phone" maxLength={30} /></label><label className={styles.liveField}><span>Pharmacist license <small>Optional</small></span><input name="license" maxLength={80} /></label></div><div className={styles.liveFormGrid}><label className={styles.liveField}><span>Temporary password</span><input name="password" type="password" minLength={10} maxLength={128} required /></label><label className={styles.liveField}><span>Confirm password</span><input name="confirmPassword" type="password" minLength={10} maxLength={128} required /></label></div><div className={styles.temporaryNote}>The pharmacist will create their own password immediately after first sign-in.</div></>}
              {modal.type === "reset" && <div className={styles.liveFormGrid}><label className={styles.liveField}><span>New temporary password</span><input name="password" type="password" minLength={10} maxLength={128} required autoFocus /></label><label className={styles.liveField}><span>Confirm password</span><input name="confirmPassword" type="password" minLength={10} maxLength={128} required /></label></div>}
              {modal.type === "status" && <div className={styles.confirmBox}>{modal.staff.isActive ? "This blocks access immediately and clears all active sessions." : "This restores sign-in access using the account’s current password."}</div>}
              {error && <div className={styles.formError} role="alert">{error}</div>}
              <div className={styles.modalActions}><button type="button" className={styles.secondaryActionButton} onClick={() => setModal(null)}>Cancel</button><button type="submit" className={`${styles.primaryButton} ${modal.type === "status" && modal.staff.isActive ? styles.dangerButton : ""}`} disabled={submitting}>{submitting ? "Saving…" : modal.type === "add" ? "Create account" : modal.type === "reset" ? "Reset password" : modal.staff.isActive ? "Deactivate" : "Activate"}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
