import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { MemberMigrationPreview, MemberMigrationResult } from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: MemberMigrationPreview;
  result: MemberMigrationResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  new: "New member",
  update: "Update member",
  conflict: "Blocked",
} as const;

function phoneNote(row: MemberMigrationPreview["rows"][number]): string | null {
  if (row.phoneStatus === "invalid") return "Invalid format · stored without phone";
  if (row.phoneStatus === "empty") return "No phone · stored as blank";
  return null;
}

export function MemberMigrationPreviewPanel({
  preview,
  result,
  confirmed,
  busy,
  onConfirmedChange,
  onImport,
}: Props) {
  const importableCount = preview.summary.newCount + preview.summary.updateCount;
  const duplicatePhoneWarningCount = preview.rows.filter((row) => row.warning).length;

  if (result) {
    return (
      <section className={styles.successPanel} aria-live="polite">
        <span className={styles.successIcon}><CheckCircle2 size={22} /></span>
        <div>
          <p className={styles.eyebrow}>Member import complete</p>
          <h2>{result.importedCount} members migrated</h2>
          <p>{result.createdCount} created, {result.updatedCount} updated, and {result.skippedConflictCount} blocked rows skipped.</p>
          <a className={styles.textLink} href="/member">Open member directory <ArrowRight size={15} /></a>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.previewPanel} aria-labelledby="member-migration-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before import</p>
          <h2 id="member-migration-preview-title">Member data preview</h2>
          <p>Source phone values remain unchanged here; normalization happens only during import.</p>
        </div>
        <div className={styles.summaryGrid} aria-label="Member preview summary">
          <div><strong>{preview.summary.totalRows}</strong><span>Total</span></div>
          <div><strong>{preview.summary.newCount}</strong><span>New</span></div>
          <div><strong>{preview.summary.updateCount}</strong><span>Updates</span></div>
          <div className={preview.summary.conflictCount ? styles.summaryConflict : undefined}>
            <strong>{preview.summary.conflictCount}</strong><span>Blocked</span>
          </div>
          <div className={preview.summary.phoneNullCount ? styles.summaryBrandReview : undefined}>
            <strong>{preview.summary.phoneNullCount}</strong><span>No phone</span>
          </div>
        </div>
      </div>

      {preview.summary.conflictCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>Blocked member rows will be skipped. Valid rows can still be imported.</span>
        </div>
      )}
      {duplicatePhoneWarningCount > 0 && (
        <div className={styles.brandNotice} role="status">
          <AlertTriangle size={18} />
          <span>{duplicatePhoneWarningCount} rows reuse a phone number. These are warnings only and the rows can still be imported.</span>
        </div>
      )}
      {preview.summary.phoneNullCount > 0 && (
        <div className={styles.brandNotice} role="status">
          <AlertTriangle size={18} />
          <span>{preview.summary.phoneNullCount} rows have a blank or invalid phone and will be stored without a phone number.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.memberTable}>
          <thead>
            <tr><th>Status</th><th>Row</th><th>Member code</th><th>Name</th><th>Address</th><th>Original phone</th><th>Member since</th><th>Import note</th></tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.rowNumber}-${row.memberCode}`}>
                <td><span className={`${styles.status} ${styles[row.status]}`}>{statusLabel[row.status]}</span></td>
                <td>{row.rowNumber}</td>
                <td><code>{row.memberCode || "—"}</code></td>
                <td><strong className={styles.memberName}>{row.name || "—"}</strong></td>
                <td><span className={styles.memberAddress} title={row.address ?? undefined}>{row.address || "—"}</span></td>
                <td>
                  <code className={styles.rawPhone}>{row.rawPhone || "—"}</code>
                  {phoneNote(row) && <small className={styles.phoneWarning}>{phoneNote(row)}</small>}
                </td>
                <td><span className={styles.memberDate}>{row.rawMembershipStartedAt || "—"}</span></td>
                <td>
                  <span className={styles.memberIssue}>{row.issue ?? (row.status === "update" ? "Matched by member code" : "Create new member")}</span>
                  {row.warning && <small className={styles.phoneWarning}>{row.warning}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
          <span>I reviewed the preview. Import valid rows and skip blocked rows.</span>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!confirmed || busy || importableCount === 0} onClick={onImport}>
          {busy ? "Importing…" : `Import ${importableCount} members`}
        </button>
      </div>
    </section>
  );
}
