"use client";

import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import type { PharmUser } from "@/server/auth/pharmUser";
import styles from "./ChangePassword.module.css";

export function ChangePasswordScreen() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== String(form.get("confirmPassword") || "")) {
      setError("Passwords do not match.");
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
      if (!response.ok || !data.user) throw new Error(data.error || "Unable to change the password.");
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to change the password.");
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}>Rx+</div>
        <span className={styles.icon}><KeyRound size={22} aria-hidden="true" /></span>
        <h1>Create your own password</h1>
        <p>The pharmacy owner gave you a temporary password. Replace it before opening the workspace.</p>
        <form onSubmit={submit}>
          <label><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required autoFocus /><small>Use at least 10 characters.</small></label>
          <label><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save password and continue"}</button>
        </form>
        <div className={styles.note}><ShieldCheck size={16} aria-hidden="true" /> Your account remains individual to you.</div>
      </section>
    </main>
  );
}
