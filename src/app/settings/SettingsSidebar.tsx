"use client";

import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Building2,
  Palette,
  Printer,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  Volume2,
} from "lucide-react";
import styles from "./Settings.module.css";

export type SettingsSection =
  | "account"
  | "appearance"
  | "store-profile"
  | "pos-preferences"
  | "staff-management"
  | "accessibility"
  | "printers-drawer"
  | "scan-feedback";

type SidebarItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  available?: boolean;
};

const accountItems: SidebarItem[] = [
  { id: "account", label: "Account", icon: UserRound, available: true },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "store-profile", label: "Store Profile", icon: Building2 },
  { id: "pos-preferences", label: "POS Preferences", icon: SlidersHorizontal, available: true },
  { id: "staff-management", label: "Staff", icon: UsersRound, ownerOnly: true, available: true },
  { id: "accessibility", label: "Accessibility", icon: Accessibility, ownerOnly: true },
];

const deviceItems: SidebarItem[] = [
  { id: "printers-drawer", label: "Printers & Cash Drawer", icon: Printer },
  { id: "scan-feedback", label: "Scan Feedback", icon: Volume2 },
];

function SettingsNavGroup({
  label,
  items,
  activeSection,
  isOwner,
  onSelect,
}: {
  label: string;
  items: SidebarItem[];
  activeSection: SettingsSection;
  isOwner: boolean;
  onSelect: (section: SettingsSection) => void;
}) {
  return (
    <div className={styles.navGroup}>
      <p className={styles.navGroupLabel}>{label}</p>
      <div className={styles.navList}>
        {items.filter((item) => !item.ownerOnly || isOwner).map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
              <span className={styles.navItemTitle}>{item.label}</span>
              {!item.available && <span className={styles.plannedDot} aria-label="Planned feature" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsSidebar({
  activeSection,
  isOwner,
  onSelect,
}: {
  activeSection: SettingsSection;
  isOwner: boolean;
  onSelect: (section: SettingsSection) => void;
}) {
  return (
    <aside className={styles.sidebar} aria-label="Settings sections">
      <SettingsNavGroup
        label="Account & Store"
        items={accountItems}
        activeSection={activeSection}
        isOwner={isOwner}
        onSelect={onSelect}
      />
      <SettingsNavGroup
        label="Devices"
        items={deviceItems}
        activeSection={activeSection}
        isOwner={isOwner}
        onSelect={onSelect}
      />
      <div className={styles.sidebarNote}>
        <span className={styles.sidebarNoteDot} aria-hidden="true" />
        POS preferences save automatically for this account.
      </div>
    </aside>
  );
}
