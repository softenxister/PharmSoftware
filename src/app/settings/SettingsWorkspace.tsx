"use client";

import { useState } from "react";
import { usePreferences } from "@/app/PreferencesProvider";
import type { PharmUser } from "@/server/auth/pharmUser";
import { PosPreferencesPanel } from "./PosPreferencesPanel";
import { AccountPanel } from "./AccountPanel";
import { AppearancePanel } from "./AppearancePanel";
import { StaffPanel } from "./StaffPanel";
import { ProductImageStoragePanel } from "./ProductImageStoragePanel";
import { StoreProfilePanel } from "./StoreProfilePanel";
import { SettingsPlaceholder } from "./SettingsPlaceholders";
import { SettingsSidebar, type SettingsSection } from "./SettingsSidebar";
import styles from "./Settings.module.css";

export function SettingsWorkspace({
  user,
  onUserUpdated,
}: {
  user: PharmUser;
  onUserUpdated?: (user: PharmUser) => void;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const { t } = usePreferences();
  const [currentUser, setCurrentUser] = useState(user);
  const isOwner = currentUser.role === "owner";
  const updateCurrentUser = (updatedUser: PharmUser) => {
    setCurrentUser(updatedUser);
    onUserUpdated?.(updatedUser);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <div className={styles.pageTitleCopy}>
            <h1>{t("nav.settings")}</h1>
          </div>
        </div>
        <div className={styles.accountSummary}>
          <span className={styles.accountAvatar}>
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.name.slice(0, 2).toUpperCase()}
          </span>
          <span className={styles.accountCopy}>
            <strong>{currentUser.name}</strong>
            <small>{isOwner ? t("common.ownerAccount") : t("common.pharmacistAccount")}</small>
          </span>
        </div>
      </header>

      <div className={styles.workspace}>
        <SettingsSidebar activeSection={activeSection} isOwner={isOwner} onSelect={setActiveSection} />
        <main className={styles.content}>
          <div className={styles.contentInner}>
            {activeSection === "account" && <AccountPanel user={currentUser} onUpdated={updateCurrentUser} />}
            {activeSection === "appearance" && <AppearancePanel />}
            {activeSection === "store-profile" && <StoreProfilePanel user={currentUser} />}
            {activeSection === "pos-preferences" && <PosPreferencesPanel user={currentUser} />}
            {activeSection === "staff-management" && isOwner && <StaffPanel />}
            {activeSection === "product-image-storage" && isOwner && <ProductImageStoragePanel />}
            {activeSection !== "account" && activeSection !== "appearance" && activeSection !== "store-profile" && activeSection !== "pos-preferences" && activeSection !== "staff-management" && activeSection !== "product-image-storage"
              && <SettingsPlaceholder section={activeSection} />}
          </div>
        </main>
      </div>
    </div>
  );
}
