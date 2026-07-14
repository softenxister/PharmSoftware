"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import type { PharmUser } from "@/server/auth/pharmUser";
import { PosPreferencesPanel } from "./PosPreferencesPanel";
import { AccountPanel } from "./AccountPanel";
import { StaffPanel } from "./StaffPanel";
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
          <span className={styles.pageTitleIcon}><Settings2 size={20} aria-hidden="true" /></span>
          <div className={styles.pageTitleCopy}>
            <h1>Settings</h1>
          </div>
        </div>
        <div className={styles.accountSummary}>
          <span className={styles.accountAvatar}>
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.name.slice(0, 2).toUpperCase()}
          </span>
          <span className={styles.accountCopy}>
            <strong>{currentUser.name}</strong>
            <small>{isOwner ? "Owner account" : "Pharmacist account"}</small>
          </span>
        </div>
      </header>

      <div className={styles.workspace}>
        <SettingsSidebar activeSection={activeSection} isOwner={isOwner} onSelect={setActiveSection} />
        <main className={styles.content}>
          <div className={styles.contentInner}>
            {activeSection === "account" && <AccountPanel user={currentUser} onUpdated={updateCurrentUser} />}
            {activeSection === "pos-preferences" && <PosPreferencesPanel user={currentUser} />}
            {activeSection === "staff-management" && isOwner && <StaffPanel />}
            {activeSection !== "account" && activeSection !== "pos-preferences" && activeSection !== "staff-management"
              && <SettingsPlaceholder section={activeSection} isOwner={isOwner} />}
          </div>
        </main>
      </div>
    </div>
  );
}
