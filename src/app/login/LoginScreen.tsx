"use client";

import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import type { PharmUser } from "@/server/auth/pharmUser";
import { INITIAL_LOGIN_MODE, resolveOwnerSetupMode, type LoginMode } from "./loginMode";
import styles from "./Login.module.css";

export function LoginScreen() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<LoginMode>(INITIAL_LOGIN_MODE);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    fetch("/api/auth/setup-owner", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ setupRequired: boolean }>;
      })
      .then((data) => { if (active) setMode(resolveOwnerSetupMode(data.setupRequired)); })
      .catch(() => {
        // Sign-in remains available even if the optional setup-status check is slow or unavailable.
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (mode === "setup" && password !== String(form.get("confirmPassword") || "")) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const payload = mode === "setup"
      ? {
        name: String(form.get("name") || ""),
        username: String(form.get("username") || ""),
        phone: String(form.get("phone") || ""),
        password,
      }
      : { username: String(form.get("username") || ""), password };
    try {
      const response = await fetch(mode === "setup" ? "/api/auth/setup-owner" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; user?: PharmUser };
      if (!response.ok || !data.user) throw new Error(data.error || "Unable to continue.");
      setUser(data.user);
      navigate(data.user.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to continue.");
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="RxPro Pharmacy">
        <div className={styles.brandMark}><span>Rx</span><strong>+</strong></div>
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>Pharmacy counter workspace</p>
          <h1>Keep every sale, stock decision, and staff account under control.</h1>
          <p>A focused workspace for the people trusted to run your pharmacy.</p>
        </div>
        <div className={styles.securityNote}>
          <ShieldCheck size={19} aria-hidden="true" />
          <span><strong>Individual access</strong><small>Each pharmacist signs in with their own account.</small></span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileBrand}><span className={styles.mobileMark}>Rx+</span> RxPro Pharmacy</div>
          <>
              <div className={styles.formHeading}>
                <span className={styles.formIcon}><LockKeyhole size={21} aria-hidden="true" /></span>
                <div>
                  <p className={styles.eyebrow}>{mode === "setup" ? "First-time setup" : "Secure sign in"}</p>
                  <h2>{mode === "setup" ? "Set up owner access" : "Welcome back"}</h2>
                </div>
              </div>
              <p className={styles.intro}>
                {mode === "setup"
                  ? "Create the pharmacy owner credential. This setup is available only once."
                  : "Enter your individual owner or pharmacist account."}
              </p>
              <form onSubmit={submit} className={styles.form}>
                {mode === "setup" && (
                  <div className={styles.twoColumns}>
                    <label><span>Owner full name</span><input name="name" autoComplete="name" minLength={2} maxLength={100} required autoFocus /></label>
                    <label><span>Phone number <small>Optional</small></span><input name="phone" autoComplete="tel" maxLength={30} /></label>
                  </div>
                )}
                <label>
                  <span>Username</span>
                  <input name="username" autoComplete="username" minLength={3} maxLength={32} required autoFocus={mode === "login"} spellCheck={false} />
                </label>
                <label>
                  <span>Password</span>
                  <div className={styles.passwordField}>
                    <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} minLength={mode === "setup" ? 10 : 1} maxLength={128} required />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {mode === "setup" && <small className={styles.fieldHint}>Use at least 10 characters.</small>}
                </label>
                {mode === "setup" && (
                  <label><span>Confirm password</span><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} required /></label>
                )}
                {error && <div className={styles.error} role="alert">{error}</div>}
                <button className={styles.submitButton} type="submit" disabled={submitting}>
                  {submitting ? "Please wait…" : mode === "setup" ? "Create owner access" : "Sign in"}
                </button>
              </form>
              {mode === "login" && <p className={styles.help}>Need access? Ask the pharmacy owner to create or reset your staff account.</p>}
          </>
        </div>
      </section>
    </main>
  );
}
