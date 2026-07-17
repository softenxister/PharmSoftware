"use client";

import { Printer, Volume2 } from "lucide-react";
import type { SettingsSection } from "./SettingsSidebar";
import styles from "./Settings.module.css";

function PlannedBanner() {
  return (
    <div className={styles.plannedBanner} role="status">
      <span className={styles.plannedBadge}>Coming soon</span>
      <span>This interface is ready for review; its controls are not connected in this release.</span>
    </div>
  );
}

function PlaceholderHeader({ title, description }: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.panelHeader}>
      <div className={styles.panelTitleGroup}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          <p className={styles.panelDescription}>{description}</p>
        </div>
      </div>
    </div>
  );
}

function AppearancePlaceholder() {
  return (
    <section className={styles.panel}>
      <PlaceholderHeader title="Appearance" description="Set a consistent display style for the pharmacy counter." />
      <PlannedBanner />
      <div className={styles.placeholderBody}>
        <h3 className={styles.sectionLabel}>Color theme</h3>
        <div className={styles.themeGrid} aria-label="Planned color themes">
          {["Pharmacy Green", "Deep Forest", "Soft Neutral"].map((theme, index) => (
            <button key={theme} type="button" className={styles.themeOption} disabled>
              <span className={`${styles.themePreview} ${styles[`themePreview${index + 1}`]}`} />
              <span>{theme}</span>
              {index === 0 && <span className={styles.currentTag}>Current</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessibilityPlaceholder() {
  return (
    <section className={styles.panel}>
      <PlaceholderHeader title="Accessibility" description="Set store-wide assistance for a clearer counter experience." />
      <PlannedBanner />
      <div className={styles.placeholderBody}>
        {["Comfortable interface density", "Larger text", "Reduce animation", "Stronger keyboard focus"].map((label) => (
          <div className={styles.disabledSettingRow} key={label}>
            <span><strong>{label}</strong><small>Owner-controlled store preference</small></span>
            <span className={styles.disabledSwitch} aria-hidden="true"><span /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DevicesPlaceholder() {
  return (
    <section className={styles.panel}>
      <PlaceholderHeader title="Printers & Cash Drawer" description="Connect and test hardware assigned to this counter." />
      <PlannedBanner />
      <div className={styles.placeholderBody}>
        <div className={styles.deviceGrid}>
          {[{ title: "Receipt printer", detail: "No printer connected" }, { title: "Automatic cash drawer", detail: "No drawer connected" }].map((device) => (
            <div className={styles.deviceCard} key={device.title}>
              <span className={styles.deviceIcon}><Printer size={18} aria-hidden="true" /></span>
              <span><strong>{device.title}</strong><small>{device.detail}</small></span>
              <span className={styles.notConnected}>Not connected</span>
              <button type="button" className={styles.secondaryButton} disabled>Set up</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScanFeedbackPlaceholder() {
  return (
    <section className={styles.panel}>
      <PlaceholderHeader title="Scan Feedback" description="Control the sound or spoken response after scanning an item." />
      <PlannedBanner />
      <div className={styles.placeholderBody}>
        <div className={styles.soundPreview}>
          <span className={styles.deviceIcon}><Volume2 size={18} aria-hidden="true" /></span>
          <span><strong>Item scanned</strong><small>Voice and confirmation sound preview</small></span>
          <button type="button" className={styles.secondaryButton} disabled>Play preview</button>
        </div>
        {["Confirmation sound", "Speak product name", "Speak available quantity"].map((label) => (
          <div className={styles.disabledSettingRow} key={label}>
            <span><strong>{label}</strong><small>Device-specific preference</small></span>
            <span className={styles.disabledSwitch} aria-hidden="true"><span /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SettingsPlaceholder({ section }: { section: SettingsSection }) {
  if (section === "appearance") return <AppearancePlaceholder />;
  if (section === "accessibility") return <AccessibilityPlaceholder />;
  if (section === "printers-drawer") return <DevicesPlaceholder />;
  return <ScanFeedbackPlaceholder />;
}
