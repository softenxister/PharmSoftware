import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Building2,
  Images,
  Palette,
  Printer,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  Volume2,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { TranslationKey } from "@/i18n/i18n";
import styles from "./Settings.module.css";

export type SettingsSection =
  | "account"
  | "appearance"
  | "store-profile"
  | "pos-preferences"
  | "staff-management"
  | "product-image-storage"
  | "accessibility"
  | "printers-drawer"
  | "scan-feedback";

type SidebarItem = {
  id: SettingsSection;
  labelKey: TranslationKey;
  icon: LucideIcon;
  ownerOnly?: boolean;
  available?: boolean;
};

const accountItems: SidebarItem[] = [
  { id: "account", labelKey: "settings.account", icon: UserRound, available: true },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette, available: true },
  { id: "store-profile", labelKey: "settings.storeProfile", icon: Building2, available: true },
  { id: "pos-preferences", labelKey: "settings.posPreferences", icon: SlidersHorizontal, available: true },
  { id: "staff-management", labelKey: "settings.staff", icon: UsersRound, ownerOnly: true, available: true },
  { id: "product-image-storage", labelKey: "settings.productImages", icon: Images, ownerOnly: true, available: true },
  { id: "accessibility", labelKey: "settings.accessibility", icon: Accessibility, ownerOnly: true },
];

const deviceItems: SidebarItem[] = [
  { id: "printers-drawer", labelKey: "settings.printersDrawer", icon: Printer },
  { id: "scan-feedback", labelKey: "settings.scanFeedback", icon: Volume2 },
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
  const { t } = usePreferences();
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
              <span className={styles.navItemTitle}>{t(item.labelKey)}</span>
              {!item.available && <span className={styles.plannedDot} aria-label={t("settings.planned")} />}
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
  const { t } = usePreferences();
  return (
    <aside className={styles.sidebar} aria-label={t("settings.sections")}>
      <SettingsNavGroup
        label={t("settings.accountStore")}
        items={accountItems}
        activeSection={activeSection}
        isOwner={isOwner}
        onSelect={onSelect}
      />
      <SettingsNavGroup
        label={t("settings.devices")}
        items={deviceItems}
        activeSection={activeSection}
        isOwner={isOwner}
        onSelect={onSelect}
      />
      <div className={styles.sidebarNote}>
        <span className={styles.sidebarNoteDot} aria-hidden="true" />
        {t("settings.autoSaveNote")}
      </div>
    </aside>
  );
}
