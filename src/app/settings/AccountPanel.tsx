"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Camera, Check, KeyRound, Save } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import type { PharmUser } from "@/server/auth/pharmUser";
import styles from "./Settings.module.css";

export function AccountPanel({ user, onUpdated }: { user: PharmUser; onUpdated: (user: PharmUser) => void }) {
  const { t } = usePreferences();
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024) {
      setError(t("account.imageError"));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          username: String(form.get("username") || ""),
          phone: String(form.get("phone") || ""),
          pharmacistLicenseNumber: String(form.get("pharmacistLicenseNumber") || ""),
          avatarUrl,
        }),
      });
      const data = await response.json() as { error?: string; user?: PharmUser };
      if (!response.ok || !data.user) throw new Error(data.error || t("account.saveError"));
      onUpdated(data.user);
      setMessage(t("account.saved"));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("account.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPasswordError("");
    setPasswordSaved(false);
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== String(form.get("confirmPassword") || "")) {
      setPasswordError(t("account.passwordMismatch"));
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: String(form.get("currentPassword") || ""), newPassword }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("account.passwordError"));
      formElement.reset();
      setPasswordSaved(true);
    } catch (submissionError) {
      setPasswordError(submissionError instanceof Error ? submissionError.message : t("account.passwordError"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>{t("settings.account")}</h2><p className={styles.panelDescription}>{t("account.description")}</p></div>
        {message && <span className={styles.savedBadge}><Check size={13} />{message}</span>}
      </div>
      <div className={styles.accountPanelBody}>
        <form onSubmit={saveProfile} className={styles.accountForm}>
          <div className={styles.avatarEditor}>
            <div className={styles.largeAvatar}>{avatarUrl ? <img src={avatarUrl} alt={t("account.currentProfile")} /> : initials}</div>
            <div className={styles.avatarEditorCopy}><strong>{t("account.profilePhoto")}</strong><small>{t("account.photoHint")}</small></div>
            <div className={styles.avatarEditorActions}>
              <label className={styles.secondaryButton}><Camera size={14} />{t("account.chooseImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} /></label>
              {avatarUrl && <button type="button" className={styles.textButton} onClick={() => setAvatarUrl(null)}>{t("account.remove")}</button>}
            </div>
          </div>
          <div className={styles.liveFormGrid}>
            <label className={styles.liveField}><span>{t("account.fullName")}</span><input name="name" defaultValue={user.name} minLength={2} maxLength={100} required /></label>
            <label className={styles.liveField}><span>{t("account.username")}</span><input name="username" defaultValue={user.username} minLength={3} maxLength={32} required spellCheck={false} /></label>
            <label className={styles.liveField}><span>{t("account.phone")} <small>{t("account.optional")}</small></span><input name="phone" defaultValue={user.phone} maxLength={30} /></label>
            <label className={styles.liveField}><span>{t("account.role")}</span><input value={user.role === "owner" ? t("common.owner") : t("common.pharmacist")} readOnly aria-readonly="true" /></label>
            {user.role === "pharmacist" && <label className={styles.liveField}><span>{t("account.license")} <small>{t("account.optional")}</small></span><input name="pharmacistLicenseNumber" defaultValue={user.pharmacistLicenseNumber || ""} maxLength={80} /></label>}
          </div>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.formActions}><button className={styles.primaryButton} type="submit" disabled={saving}><Save size={14} />{saving ? t("common.saving") : t("account.save")}</button></div>
        </form>

        <form onSubmit={changePassword} className={styles.passwordCard}>
          <div className={styles.subsectionHeading}><span><KeyRound size={17} /></span><div><h3>{t("account.changePassword")}</h3><p>{t("account.changePasswordHint")}</p></div></div>
          <div className={styles.passwordFields}>
            <label className={styles.liveField}><span>{t("account.currentPassword")}</span><input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></label>
            <label className={styles.liveField}><span>{t("password.new")}</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
            <label className={styles.liveField}><span>{t("password.confirm")}</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
          </div>
          {passwordError && <div className={styles.formError} role="alert">{passwordError}</div>}
          {passwordSaved && <div className={styles.formSuccess} role="status"><Check size={14} />{t("account.passwordChanged")}</div>}
          <div className={styles.formActions}><button className={styles.secondaryActionButton} type="submit" disabled={passwordSaving}>{passwordSaving ? t("account.updating") : t("account.updatePassword")}</button></div>
        </form>
      </div>
    </section>
  );
}
