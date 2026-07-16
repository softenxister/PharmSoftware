"use client";

import { Check, ShieldCheck } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import type { TranslationKey } from "@/app/i18n/i18n";
import { Switch } from "@/features/events/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/events/components/ui/select";
import type { PharmUser } from "@/server/auth/pharmUser";
import type { PosPreferences, SalesLanding } from "./posPreferences";
import {
  STORE_PAYMENT_METHODS,
  getPaymentMethodShortcut,
  type StorePaymentMethod,
} from "./storePosSettings";
import { usePosPreferences } from "./usePosPreferences";
import { useStorePosSettings } from "./useStorePosSettings";
import styles from "./Settings.module.css";

type BooleanPreferenceKey = Exclude<keyof PosPreferences, "defaultSalesLanding">;

const preferenceRows: Array<{
  key: BooleanPreferenceKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = [
  {
    key: "showAvailableStock",
    titleKey: "pos.showStock",
    descriptionKey: "pos.showStockHint",
  },
  {
    key: "showKeyboardHints",
    titleKey: "pos.keyboardHints",
    descriptionKey: "pos.keyboardHintsHint",
  },
  {
    key: "confirmDestructiveActions",
    titleKey: "pos.confirmActions",
    descriptionKey: "pos.confirmActionsHint",
  },
];

export function PosPreferencesPanel({ user }: { user: PharmUser }) {
  const { t } = usePreferences();
  const { preferences, updatePreferences, isReady } = usePosPreferences(user);
  const {
    settings: storeSettings,
    isReady: storeSettingsReady,
    isSaving: storeSettingsSaving,
    error: storeSettingsError,
    updateStoreSettings,
  } = useStorePosSettings();
  const isOwner = user.role === "owner";
  const preferenceStatus = storeSettingsError
    ? t("pos.storeUnavailable")
    : isReady && storeSettingsReady && !storeSettingsSaving
      ? t("pos.savedAuto")
      : t("pos.saving");
  const paymentMethodLabel = (method: StorePaymentMethod) => t(method === "Cash"
    ? "pos.cash"
    : method === "Bank transfer" ? "pos.bankTransfer" : "pos.creditCard");

  const setBooleanPreference = (key: BooleanPreferenceKey, checked: boolean) => {
    updatePreferences((current) => ({ ...current, [key]: checked }));
  };
  const setLanding = (landing: SalesLanding) => {
    updatePreferences((current) => ({ ...current, defaultSalesLanding: landing }));
  };
  const setShowProductLocation = (checked: boolean) => {
    if (!isOwner) return;
    void updateStoreSettings({ ...storeSettings, showProductLocation: checked });
  };
  const togglePaymentMethod = (method: StorePaymentMethod, checked: boolean) => {
    if (!isOwner) return;
    const selected = new Set(storeSettings.paymentMethods);
    if (checked) selected.add(method);
    else selected.delete(method);
    if (selected.size === 0) return;
    void updateStoreSettings({
      ...storeSettings,
      paymentMethods: STORE_PAYMENT_METHODS.filter((candidate) => selected.has(candidate)),
    });
  };

  return (
    <section className={styles.panel} aria-labelledby="pos-preferences-title">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <div>
            <h2 id="pos-preferences-title" className={styles.panelTitle}>{t("settings.posPreferences")}</h2>
            <p className={styles.panelDescription}>{t("pos.description")}</p>
          </div>
        </div>
        <span className={styles.savedBadge} role="status">
          <Check size={13} aria-hidden="true" />
          {preferenceStatus}
        </span>
      </div>

      <div className={styles.accountNotice}>
        <ShieldCheck size={17} aria-hidden="true" />
        <span><strong>{t("pos.workspace", { name: user.name })}</strong> {t("pos.workspaceDetail")}</span>
      </div>

      <div className={styles.preferenceList}>
        <div className={styles.preferenceGroupHeader}>
          <h3>{t("pos.myWorkspace")}</h3>
          <p>{t("pos.myWorkspaceHint")}</p>
        </div>
        {preferenceRows.map((row) => {
          const labelId = `preference-${row.key}`;
          const checked = preferences[row.key];
          return (
            <div className={styles.preferenceRow} key={row.key}>
              <div className={styles.preferenceCopy}>
                <h3 id={labelId} className={styles.preferenceTitle}>{t(row.titleKey)}</h3>
                <p className={styles.preferenceDescription}>{t(row.descriptionKey)}</p>
              </div>
              <div className={styles.switchControl}>
                <span className={styles.switchState}>{checked ? t("pos.on") : t("pos.off")}</span>
                <Switch
                  className={styles.preferenceSwitch}
                  checked={checked}
                  disabled={!isReady}
                  onCheckedChange={(next) => setBooleanPreference(row.key, next)}
                  aria-labelledby={labelId}
                />
              </div>
            </div>
          );
        })}

        <div className={styles.preferenceRow}>
          <div className={styles.preferenceCopy}>
            <h3 id="default-sales-landing" className={styles.preferenceTitle}>{t("pos.defaultLanding")}</h3>
            <p className={styles.preferenceDescription}>{t("pos.defaultLandingHint")}</p>
          </div>
          <Select
            value={preferences.defaultSalesLanding}
            disabled={!isReady}
            onValueChange={(value) => setLanding(value as SalesLanding)}
          >
            <SelectTrigger className={styles.selectTrigger} aria-labelledby="default-sales-landing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={styles.selectContent} position="popper">
              <SelectItem className={styles.selectItem} value="new-sale">{t("nav.newSale")}</SelectItem>
              <SelectItem className={styles.selectItem} value="sales-history">{t("pos.salesHistory")}</SelectItem>
              <SelectItem className={styles.selectItem} value="pending-payments">{t("pos.pendingPayments")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.preferenceGroupHeader}>
          <h3>{t("pos.storeSetup")}</h3>
          <p>{isOwner ? t("pos.storeSetupOwner") : t("pos.storeSetupStaff")}</p>
        </div>

        <div className={styles.preferenceRow}>
          <div className={styles.preferenceCopy}>
            <h3 id="show-product-location" className={styles.preferenceTitle}>{t("pos.showLocation")}</h3>
            <p className={styles.preferenceDescription}>{t("pos.showLocationHint")}</p>
          </div>
          <div className={styles.switchControl}>
            <span className={styles.switchState}>{storeSettings.showProductLocation ? t("pos.on") : t("pos.off")}</span>
            <Switch
              className={styles.preferenceSwitch}
              checked={storeSettings.showProductLocation}
              disabled={!isOwner || !storeSettingsReady || storeSettingsSaving}
              onCheckedChange={setShowProductLocation}
              aria-labelledby="show-product-location"
            />
          </div>
        </div>

        <div className={`${styles.preferenceRow} ${styles.paymentMethodsRow}`}>
          <div className={styles.preferenceCopy}>
            <h3 className={styles.preferenceTitle}>{t("pos.paymentMethods")}</h3>
            <p className={styles.preferenceDescription}>{t("pos.paymentMethodsHint")}</p>
          </div>
          <div className={styles.paymentMethodList}>
            {STORE_PAYMENT_METHODS.map((method) => {
              const checked = storeSettings.paymentMethods.includes(method);
              const isOnlyMethod = checked && storeSettings.paymentMethods.length === 1;
              return (
                <label className={styles.paymentMethodOption} key={method}>
                  <span><kbd>{getPaymentMethodShortcut(method)}</kbd>{paymentMethodLabel(method)}</span>
                  <Switch
                    className={styles.preferenceSwitch}
                    checked={checked}
                    disabled={!isOwner || !storeSettingsReady || storeSettingsSaving || isOnlyMethod}
                    onCheckedChange={(next) => togglePaymentMethod(method, next)}
                    aria-label={t(checked ? "pos.disableMethod" : "pos.enableMethod", { method: paymentMethodLabel(method) })}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {storeSettingsError && <p className={styles.settingsError} role="alert">{t("pos.storeUnavailable")}</p>}
      <p className={styles.defaultNote}>{t("pos.defaultNote")}</p>
    </section>
  );
}
