"use client";

import { Check, ShieldCheck } from "lucide-react";
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
  title: string;
  description: string;
}> = [
  {
    key: "showAvailableStock",
    title: "Show available stock",
    description: "Show on-hand quantities while choosing products and batches.",
  },
  {
    key: "showKeyboardHints",
    title: "Show keyboard shortcut hints",
    description: "Display compact key hints beside supported POS actions.",
  },
  {
    key: "confirmDestructiveActions",
    title: "Confirm item removal and sale cancellation",
    description: "Ask before removing a cart line or leaving an unsaved sale.",
  },
];

export function PosPreferencesPanel({ user }: { user: PharmUser }) {
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
    ? "Store setup unavailable"
    : isReady && storeSettingsReady && !storeSettingsSaving
      ? "Saved automatically"
      : "Saving preferences";

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
            <h2 id="pos-preferences-title" className={styles.panelTitle}>POS Preferences</h2>
            <p className={styles.panelDescription}>Choose what you see and how the sales workspace behaves.</p>
          </div>
        </div>
        <span className={styles.savedBadge} role="status">
          <Check size={13} aria-hidden="true" />
          {preferenceStatus}
        </span>
      </div>

      <div className={styles.accountNotice}>
        <ShieldCheck size={17} aria-hidden="true" />
        <span><strong>{user.name}&apos;s workspace.</strong> Personal choices apply only to this account; store setup is owner-controlled.</span>
      </div>

      <div className={styles.preferenceList}>
        <div className={styles.preferenceGroupHeader}>
          <h3>My sales workspace</h3>
          <p>These choices apply only to this account.</p>
        </div>
        {preferenceRows.map((row) => {
          const labelId = `preference-${row.key}`;
          const checked = preferences[row.key];
          return (
            <div className={styles.preferenceRow} key={row.key}>
              <div className={styles.preferenceCopy}>
                <h3 id={labelId} className={styles.preferenceTitle}>{row.title}</h3>
                <p className={styles.preferenceDescription}>{row.description}</p>
              </div>
              <div className={styles.switchControl}>
                <span className={styles.switchState}>{checked ? "On" : "Off"}</span>
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
            <h3 id="default-sales-landing" className={styles.preferenceTitle}>Default sales landing view</h3>
            <p className={styles.preferenceDescription}>Choose which page opens when you select Sales in the main navigation.</p>
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
              <SelectItem className={styles.selectItem} value="new-sale">New Sale</SelectItem>
              <SelectItem className={styles.selectItem} value="sales-history">Sales History</SelectItem>
              <SelectItem className={styles.selectItem} value="pending-payments">Pending Payments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.preferenceGroupHeader}>
          <h3>Store sales setup</h3>
          <p>{isOwner ? "Owner-controlled choices shared by every counter and account." : "Shared store choices managed by the owner."}</p>
        </div>

        <div className={styles.preferenceRow}>
          <div className={styles.preferenceCopy}>
            <h3 id="show-product-location" className={styles.preferenceTitle}>Show product location</h3>
            <p className={styles.preferenceDescription}>Display shelf or storage locations throughout New Sale.</p>
          </div>
          <div className={styles.switchControl}>
            <span className={styles.switchState}>{storeSettings.showProductLocation ? "On" : "Off"}</span>
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
            <h3 className={styles.preferenceTitle}>Accepted payment methods</h3>
            <p className={styles.preferenceDescription}>Choose the methods available at every counter. At least one is required.</p>
          </div>
          <div className={styles.paymentMethodList}>
            {STORE_PAYMENT_METHODS.map((method) => {
              const checked = storeSettings.paymentMethods.includes(method);
              const isOnlyMethod = checked && storeSettings.paymentMethods.length === 1;
              return (
                <label className={styles.paymentMethodOption} key={method}>
                  <span><kbd>{getPaymentMethodShortcut(method)}</kbd>{method}</span>
                  <Switch
                    className={styles.preferenceSwitch}
                    checked={checked}
                    disabled={!isOwner || !storeSettingsReady || storeSettingsSaving || isOnlyMethod}
                    onCheckedChange={(next) => togglePaymentMethod(method, next)}
                    aria-label={`${checked ? "Disable" : "Enable"} ${method}`}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {storeSettingsError && <p className={styles.settingsError} role="alert">{storeSettingsError}</p>}
      <p className={styles.defaultNote}>New accounts start with personal switches off and New Sale selected.</p>
    </section>
  );
}
