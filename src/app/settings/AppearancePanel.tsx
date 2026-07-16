"use client";

import { Check, Languages, Palette } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import type { AppLocale } from "./appPreferences";
import styles from "./Settings.module.css";

const languageOptions: Array<{ value: AppLocale; code: string }> = [
  { value: "en", code: "EN" },
  { value: "th", code: "TH" },
];

export function AppearancePanel() {
  const { preferences, isReady, isSaving, saveError, updatePreferences, t } = usePreferences();

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <span className={styles.deviceIcon}><Languages size={18} aria-hidden="true" /></span>
          <div>
            <h2 className={styles.panelTitle}>{t("appearance.title")}</h2>
            <p className={styles.panelDescription}>{t("appearance.description")}</p>
          </div>
        </div>
        <span className={styles.savedBadge} aria-live="polite">
          {!isReady ? t("common.loading") : isSaving ? t("common.saving") : t("common.saved")}
        </span>
      </div>

      {saveError && <p className={styles.settingsError} role="alert">{t("appearance.saveError")}</p>}

      <div className={styles.preferenceList}>
        <div className={styles.preferenceRow}>
          <div className={styles.preferenceCopy}>
            <h3 className={styles.preferenceTitle}>{t("appearance.language")}</h3>
            <p className={styles.preferenceDescription}>{t("appearance.languageHint")}</p>
          </div>
          <div className={styles.languageSelector} role="group" aria-label={t("appearance.language")}>
            {languageOptions.map((option) => {
              const selected = preferences.locale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.languageOption} ${selected ? styles.languageOptionActive : ""}`}
                  aria-pressed={selected}
                  disabled={!isReady || isSaving}
                  onClick={() => void updatePreferences({ locale: option.value })}
                >
                  <span className={styles.languageCode}>{option.code}</span>
                  <span>{option.value === "en" ? t("common.english") : t("common.thai")}</span>
                  {selected && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.preferenceRow}>
          <div className={styles.preferenceCopy}>
            <h3 className={styles.preferenceTitle}>{t("appearance.theme")}</h3>
            <p className={styles.preferenceDescription}>{t("appearance.themeHint")}</p>
          </div>
          <button type="button" className={styles.themeSummary} disabled>
            <Palette size={16} aria-hidden="true" />
            <span>{t("appearance.pharmacyGreen")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
