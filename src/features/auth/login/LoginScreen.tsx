import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { PharmUser } from "@server/auth/pharmUser";
import { INITIAL_LOGIN_MODE, resolveOwnerSetupMode, type LoginMode } from "./loginMode";
import styles from "./Login.module.css";

export function LoginScreen() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { preferences, updatePreferences, t } = usePreferences();
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
      setError(t("password.mismatch"));
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
      if (!response.ok || !data.user) {
        throw new Error(mode === "login" && response.status === 401
          ? t("auth.invalidCredentials")
          : data.error || t("auth.continueError"));
      }
      setUser(data.user);
      navigate(data.user.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("auth.continueError"));
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="RxPro Pharmacy">
        <div className={styles.brandMark}><span>Rx</span><strong>+</strong></div>
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>{t("auth.counterWorkspace")}</p>
          <h1>{t("auth.brandTitle")}</h1>
          <p>{t("auth.brandIntro")}</p>
        </div>
        <div className={styles.securityNote}>
          <ShieldCheck size={19} aria-hidden="true" />
          <span><strong>{t("auth.individualAccess")}</strong><small>{t("auth.individualAccessHint")}</small></span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.languageToggle} role="group" aria-label={t("appearance.language")}>
            {(["en", "th"] as const).map((locale) => (
              <button
                key={locale}
                type="button"
                aria-pressed={preferences.locale === locale}
                className={preferences.locale === locale ? styles.languageActive : ""}
                onClick={() => void updatePreferences({ locale })}
              >
                {locale.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={styles.mobileBrand}><span className={styles.mobileMark}>Rx+</span> RxPro Pharmacy</div>
          <>
              <div className={styles.formHeading}>
                <span className={styles.formIcon}><LockKeyhole size={21} aria-hidden="true" /></span>
                <div>
                  <p className={styles.eyebrow}>{mode === "setup" ? t("auth.firstSetup") : t("auth.secureSignIn")}</p>
                  <h2>{mode === "setup" ? t("auth.setupOwner") : t("auth.welcomeBack")}</h2>
                </div>
              </div>
              <p className={styles.intro}>
                {mode === "setup"
                  ? t("auth.setupIntro")
                  : t("auth.loginIntro")}
              </p>
              <form onSubmit={submit} className={styles.form}>
                {mode === "setup" && (
                  <div className={styles.twoColumns}>
                    <label><span>{t("auth.ownerName")}</span><input name="name" autoComplete="name" minLength={2} maxLength={100} required autoFocus /></label>
                    <label><span>{t("account.phone")} <small>{t("account.optional")}</small></span><input name="phone" autoComplete="tel" maxLength={30} /></label>
                  </div>
                )}
                <label>
                  <span>{t("account.username")}</span>
                  <input name="username" autoComplete="username" minLength={3} maxLength={32} required autoFocus={mode === "login"} spellCheck={false} />
                </label>
                <label>
                  <span>{t("auth.password")}</span>
                  <div className={styles.passwordField}>
                    <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} minLength={mode === "setup" ? 10 : 1} maxLength={128} required />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {mode === "setup" && <small className={styles.fieldHint}>{t("password.hint")}</small>}
                </label>
                {mode === "setup" && (
                  <label><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} required /></label>
                )}
                {error && <div className={styles.error} role="alert">{error}</div>}
                <button className={`${styles.submitButton} ${mode === "setup" ? styles.createActionButton : ""}`} type="submit" disabled={submitting}>
                  {submitting ? t("auth.wait") : mode === "setup" ? t("auth.createOwner") : t("auth.signIn")}
                </button>
              </form>
              {mode === "login" && <p className={styles.help}>{t("auth.help")}</p>}
          </>
        </div>
      </section>
    </main>
  );
}
