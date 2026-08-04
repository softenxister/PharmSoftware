import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { StockDetailUpdatePreview, StockDetailUpdateResult } from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: StockDetailUpdatePreview;
  result: StockDetailUpdateResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  changed: "Will update",
  unchanged: "Unchanged",
  unmatched: "No code match",
  invalid: "Invalid",
} as const;

function textChange(current: string | null, next: string | null) {
  return <><small>{current || "—"}</small><strong>→ {next || "—"}</strong></>;
}

function costChange(current: number | null, next: number | null) {
  const money = (value: number | null) => value === null
    ? "—"
    : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return <><small>{money(current)}</small><strong>→ {money(next)}</strong></>;
}

export function StockDetailUpdatePreviewPanel({
  preview,
  result,
  confirmed,
  busy,
  onConfirmedChange,
  onImport,
}: Props) {
  if (result) {
    return (
      <section className={styles.successPanel} aria-live="polite">
        <span className={styles.successIcon}><CheckCircle2 size={22} /></span>
        <div>
          <p className={styles.eyebrow}>Update complete</p>
          <h2>{result.updatedCount} products updated</h2>
          <p>{result.unchangedCount} unchanged, {result.unmatchedCount} unmatched, and {result.invalidCount} invalid rows skipped.</p>
          <a className={styles.textLink} href="/stock">Open stock inventory <ArrowRight size={15} /></a>
        </div>
      </section>
    );
  }

  const blockedCount = preview.summary.unmatchedCount + preview.summary.invalidCount;
  return (
    <section className={styles.previewPanel} aria-labelledby="detail-update-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before update</p>
          <h2 id="detail-update-preview-title">Generic name &amp; base-unit cost preview</h2>
          <p>Only exact CW product-code matches can change. Item identity, packaging, prices, and stock stay untouched.</p>
        </div>
        <div className={styles.summaryGrid} aria-label="Focused update summary">
          <div><strong>{preview.summary.changedCount}</strong><span>Changes</span></div>
          <div><strong>{preview.summary.unchangedCount}</strong><span>Unchanged</span></div>
          <div className={preview.summary.unmatchedCount ? styles.summaryConflict : undefined}><strong>{preview.summary.unmatchedCount}</strong><span>Unmatched</span></div>
          <div className={preview.summary.invalidCount ? styles.summaryConflict : undefined}><strong>{preview.summary.invalidCount}</strong><span>Invalid</span></div>
          <div><strong>{preview.summary.totalRows}</strong><span>Total</span></div>
        </div>
      </div>

      {blockedCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>{blockedCount} rows will be skipped. Focused update never creates products or falls back to item name or barcode.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.detailUpdateTable}>
          <thead><tr><th>Status</th><th>CSV row</th><th>CW product code</th><th>Matched product</th><th>Generic name: current → new</th><th>Base cost: current → new</th><th>Note</th></tr></thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.sourceRow}-${row.externalProductCode}`}>
                <td><span className={`${styles.status} ${styles[row.status]}`}>{statusLabel[row.status]}</span></td>
                <td>{row.sourceRow}</td>
                <td><code>{row.externalProductCode}</code></td>
                <td><strong>{row.matchedItemName ?? "—"}</strong></td>
                <td className={styles.changeCell}>{textChange(row.currentGenericName, row.nextGenericName)}</td>
                <td className={styles.changeCell}>{costChange(row.currentCostThb, row.nextCostThb)}</td>
                <td>{row.issue ?? (row.status === "unchanged" ? "No new G/I value" : "Ready")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
          <span>I confirm this update may change only the raw generic name and base-unit latest cost. Names, barcodes, packaging, selling prices, verified ingredients, and stock remain unchanged.</span>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!confirmed || busy || preview.summary.changedCount === 0} onClick={onImport}>
          {busy ? "Updating…" : `Update ${preview.summary.changedCount} products`}
        </button>
      </div>
    </section>
  );
}
