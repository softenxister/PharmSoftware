import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { AppLocale, ColorTheme } from "@/config/preferences/appPreferences";
import styles from "./Settings.module.css";

const languageOptions: Array<{ value: AppLocale; code: string }> = [
  { value: "en", code: "EN" },
  { value: "th", code: "TH" },
];

const themeOptions: Array<{ value: ColorTheme; labelKey: "appearance.pharmacyGreen" | "appearance.pink" | "appearance.orange" | "appearance.purple" }> = [
  { value: "pharmacy-green", labelKey: "appearance.pharmacyGreen" },
  { value: "pink", labelKey: "appearance.pink" },
  { value: "orange", labelKey: "appearance.orange" },
  { value: "purple", labelKey: "appearance.purple" },
];

export function AppearancePanel() {
  const { preferences, isReady, isSaving, saveError, updatePreferences, t } = usePreferences();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const selectedTheme = themeOptions.find((option) => option.value === preferences.colorTheme) ?? themeOptions[0];

  useEffect(() => {
    if (!themeDropdownOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!themeDropdownRef.current?.contains(event.target as Node)) setThemeDropdownOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeDropdownOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [themeDropdownOpen]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{t("appearance.title")}</h2>
          <p className={styles.panelDescription}>{t("appearance.description")}</p>
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
          <div className={styles.themeSelector} ref={themeDropdownRef}>
            <button
              type="button"
              className={styles.themeDropdownButton}
              aria-haspopup="listbox"
              aria-expanded={themeDropdownOpen}
              aria-controls="appearance-theme-options"
              disabled={!isReady || isSaving}
              onClick={() => setThemeDropdownOpen((open) => !open)}
            >
              <span className={styles.themeSwatch} data-theme-option={selectedTheme.value} aria-hidden="true" />
              <span>{t(selectedTheme.labelKey)}</span>
              <ChevronDown className={themeDropdownOpen ? styles.themeDropdownChevronOpen : undefined} size={15} aria-hidden="true" />
            </button>

            {themeDropdownOpen && (
              <div className={styles.themeDropdownMenu} id="appearance-theme-options" role="listbox" aria-label={t("appearance.theme")}>
                {themeOptions.map((option) => {
                  const selected = preferences.colorTheme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.themeDropdownOption} ${selected ? styles.themeDropdownOptionActive : ""}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setThemeDropdownOpen(false);
                        void updatePreferences({ colorTheme: option.value });
                      }}
                    >
                      <span className={styles.themeSwatch} data-theme-option={option.value} aria-hidden="true" />
                      <span>{t(option.labelKey)}</span>
                      {selected && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
