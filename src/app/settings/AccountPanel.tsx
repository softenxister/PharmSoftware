"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Camera, Check, KeyRound, Save } from "lucide-react";
import type { PharmUser } from "@/server/auth/pharmUser";
import styles from "./Settings.module.css";

export function AccountPanel({ user, onUpdated }: { user: PharmUser; onUpdated: (user: PharmUser) => void }) {
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
      setError("Choose a PNG, JPEG, or WebP image no larger than 512 KB.");
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
      if (!response.ok || !data.user) throw new Error(data.error || "Unable to save your account.");
      onUpdated(data.user);
      setMessage("Account saved");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save your account.");
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
      setPasswordError("New passwords do not match.");
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
      if (!response.ok) throw new Error(data.error || "Unable to change your password.");
      formElement.reset();
      setPasswordSaved(true);
    } catch (submissionError) {
      setPasswordError(submissionError instanceof Error ? submissionError.message : "Unable to change your password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2 className={styles.panelTitle}>Account</h2><p className={styles.panelDescription}>Your personal profile and sign-in details.</p></div>
        {message && <span className={styles.savedBadge}><Check size={13} />{message}</span>}
      </div>
      <div className={styles.accountPanelBody}>
        <form onSubmit={saveProfile} className={styles.accountForm}>
          <div className={styles.avatarEditor}>
            <div className={styles.largeAvatar}>{avatarUrl ? <img src={avatarUrl} alt="Current profile" /> : initials}</div>
            <div><strong>Profile photo</strong><small>PNG, JPEG, or WebP · up to 512 KB</small></div>
            <label className={styles.secondaryButton}><Camera size={14} />Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} /></label>
            {avatarUrl && <button type="button" className={styles.textButton} onClick={() => setAvatarUrl(null)}>Remove</button>}
          </div>
          <div className={styles.liveFormGrid}>
            <label className={styles.liveField}><span>Full name</span><input name="name" defaultValue={user.name} minLength={2} maxLength={100} required /></label>
            <label className={styles.liveField}><span>Username</span><input name="username" defaultValue={user.username} minLength={3} maxLength={32} required spellCheck={false} /></label>
            <label className={styles.liveField}><span>Phone number <small>Optional</small></span><input name="phone" defaultValue={user.phone} maxLength={30} /></label>
            <label className={styles.liveField}><span>Role</span><input value={user.role === "owner" ? "Owner" : "Pharmacist"} readOnly aria-readonly="true" /></label>
            {user.role === "pharmacist" && <label className={styles.liveField}><span>Pharmacist license <small>Optional</small></span><input name="pharmacistLicenseNumber" defaultValue={user.pharmacistLicenseNumber || ""} maxLength={80} /></label>}
          </div>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.formActions}><button className={styles.primaryButton} type="submit" disabled={saving}><Save size={14} />{saving ? "Saving…" : "Save account"}</button></div>
        </form>

        <form onSubmit={changePassword} className={styles.passwordCard}>
          <div className={styles.subsectionHeading}><span><KeyRound size={17} /></span><div><h3>Change password</h3><p>Changing it signs your account out on other devices.</p></div></div>
          <div className={styles.passwordFields}>
            <label className={styles.liveField}><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></label>
            <label className={styles.liveField}><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
            <label className={styles.liveField}><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
          </div>
          {passwordError && <div className={styles.formError} role="alert">{passwordError}</div>}
          {passwordSaved && <div className={styles.formSuccess} role="status"><Check size={14} />Password changed</div>}
          <div className={styles.formActions}><button className={styles.secondaryActionButton} type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating…" : "Update password"}</button></div>
        </form>
      </div>
    </section>
  );
}
