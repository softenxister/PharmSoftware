import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DistributorMigrationPreview, DistributorMigrationResult } from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: DistributorMigrationPreview;
  result: DistributorMigrationResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  new: "New distributor",
  update: "Update distributor",
  conflict: "Blocked",
} as const;

function matchNote(row: DistributorMigrationPreview["rows"][number]): string {
  if (row.issue) return row.issue;
  if (row.matchReason === "code") return `Matched by code${row.matchedDistributorName ? ` · ${row.matchedDistributorName}` : ""}`;
  if (row.matchReason === "name") return "Matched by exact name · code will be attached";
  return "Create new distributor";
}

export function DistributorMigrationPreviewPanel({
  preview,
  result,
  confirmed,
  busy,
  onConfirmedChange,
  onImport,
}: Props) {
  const importableCount = preview.summary.newCount + preview.summary.updateCount;

  if (result) {
    return (
      <section className={styles.successPanel} aria-live="polite">
        <span className={styles.successIcon}><CheckCircle2 size={22} /></span>
        <div>
          <p className={styles.eyebrow}>Distributor import complete</p>
          <h2>{result.importedCount} distributors migrated</h2>
          <p>{result.createdCount} created, {result.updatedCount} updated, and {result.skippedConflictCount} blocked rows skipped.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.previewPanel} aria-labelledby="distributor-migration-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before import</p>
          <h2 id="distributor-migration-preview-title">Distributor data preview</h2>
          <p>Only CW distributor code and name will be written. Address and contact details are ignored.</p>
        </div>
        <div className={styles.summaryGrid} aria-label="Distributor preview summary">
          <div><strong>{preview.summary.totalRows}</strong><span>Total</span></div>
          <div><strong>{preview.summary.newCount}</strong><span>New</span></div>
          <div><strong>{preview.summary.updateCount}</strong><span>Updates</span></div>
          <div className={preview.summary.conflictCount ? styles.summaryConflict : undefined}><strong>{preview.summary.conflictCount}</strong><span>Blocked</span></div>
          <div><strong>{importableCount}</strong><span>Importable</span></div>
        </div>
      </div>

      {preview.summary.conflictCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>Blocked distributor rows will be skipped. Valid rows can still be imported.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.distributorTable}>
          <thead><tr><th>Status</th><th>Row</th><th>CW code</th><th>Distributor name</th><th>Match</th><th>Import note</th></tr></thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.rowNumber}-${row.code}`}>
                <td><span className={`${styles.status} ${styles[row.status]}`}>{statusLabel[row.status]}</span></td>
                <td>{row.rowNumber}</td>
                <td><code>{row.code || "—"}</code></td>
                <td><strong className={styles.memberName}>{row.name || "—"}</strong></td>
                <td>{row.matchReason ?? "—"}</td>
                <td><span className={styles.memberIssue}>{matchNote(row)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
          <span>I reviewed the preview. Import code/name rows and skip blocked rows.</span>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!confirmed || busy || importableCount === 0} onClick={onImport}>
          {busy ? "Importing…" : `Import ${importableCount} distributors`}
        </button>
      </div>
    </section>
  );
}
