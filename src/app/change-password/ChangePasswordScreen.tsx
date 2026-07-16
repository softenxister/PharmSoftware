"use client";

import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { usePreferences } from "@/app/PreferencesProvider";
import type { PharmUser } from "@/server/auth/pharmUser";
import styles from "./ChangePassword.module.css";

export function ChangePasswordScreen() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { t } = usePreferences();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== String(form.get("confirmPassword") || "")) {
      setError(t("password.mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json() as { error?: string; user?: PharmUser };
      if (!response.ok || !data.user) throw new Error(data.error || t("password.changeError"));
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("password.changeError"));
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}>Rx+</div>
        <span className={styles.icon}><KeyRound size={22} aria-hidden="true" /></span>
        <h1>{t("password.title")}</h1>
        <p>{t("password.intro")}</p>
        <form onSubmit={submit}>
          <label><span>{t("password.new")}</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required autoFocus /><small>{t("password.hint")}</small></label>
          <label><span>{t("password.confirm")}</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? t("password.saving") : t("password.saveContinue")}</button>
        </form>
        <div className={styles.note}><ShieldCheck size={16} aria-hidden="true" /> {t("password.individual")}</div>
      </section>
    </main>
  );
}
