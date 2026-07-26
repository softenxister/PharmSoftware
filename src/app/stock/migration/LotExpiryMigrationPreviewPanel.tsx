import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  LotExpiryMigrationPreview,
  LotExpiryMigrationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: LotExpiryMigrationPreview;
  result: LotExpiryMigrationResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  matched: "Matched",
  unmatched: "Not matched",
  conflict: "Blocked",
} as const;

export function LotExpiryMigrationPreviewPanel({
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
          <p className={styles.eyebrow}>Lot and expiry import complete</p>
          <h2>{result.replacedProductCount} products replaced</h2>
          <p>
            {result.createdBatchCount} batches created. {result.skippedUnmatchedCount} unmatched
            and {result.skippedConflictCount} blocked products were skipped.
          </p>
        </div>
      </section>
    );
  }

  const skippedCount = preview.summary.unmatchedProducts + preview.summary.conflictProducts;

  return (
    <section className={styles.previewPanel} aria-labelledby="lot-expiry-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before replacement</p>
          <h2 id="lot-expiry-preview-title">Lot and expiry preview</h2>
          <p>{preview.summary.totalProducts} CW products evaluated before any batches are changed.</p>
        </div>
        <div className={styles.summaryGrid} aria-label="Lot and expiry preview summary">
          <div><strong>{preview.summary.matchedProducts}</strong><span>Matched</span></div>
          <div className={preview.summary.unmatchedProducts ? styles.summaryConflict : undefined}>
            <strong>{preview.summary.unmatchedProducts}</strong><span>Unmatched</span>
          </div>
          <div><strong>{preview.summary.totalBatches}</strong><span>Batches</span></div>
          <div><strong>{preview.summary.generatedLotCount}</strong><span>Generated lots</span></div>
          <div><strong>{preview.summary.remainderProducts}</strong><span>Remainder batches</span></div>
        </div>
      </div>

      {skippedCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>
            {skippedCount} unmatched or blocked products will be skipped. All matched products
            can still be imported.
          </span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.lotTable}>
          <thead>
            <tr>
              <th>Status</th><th>CW product</th><th>Database match</th><th>Normalized batches</th>
              <th>Total</th><th>Remainder</th><th>Import note</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.sourceRow}-${row.externalProductCode}`}>
                <td>
                  <span className={`${styles.status} ${
                    styles[row.status === "matched" ? "update" : "conflict"]
                  }`}>
                    {statusLabel[row.status]}
                  </span>
                </td>
                <td><code>{row.externalProductCode}</code><small>{row.itemName}</small></td>
                <td>{row.matchedItemName ?? "—"}</td>
                <td>
                  <div className={styles.lotList}>
                    {row.batches.map((batch) => (
                      <span key={`${batch.lotNo}\0${batch.expiryDate}`}>
                        <strong>{batch.lotNo || "-"}{batch.generatedLotNo ? " · generated" : ""}</strong>
                        <small>{batch.expiryDate || "-"} · {batch.amount} {batch.unit}</small>
                      </span>
                    ))}
                  </div>
                </td>
                <td>{row.reportedAmount} {row.unit}</td>
                <td>{row.remainderAmount > 0 ? `${row.remainderAmount} ${row.unit}` : "—"}</td>
                <td><span className={styles.memberIssue}>{row.issue ?? "Replace all existing batches"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
          />
          <span>
            I reviewed the preview and understand that every existing batch for matched products
            will be permanently replaced.
          </span>
        </label>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!confirmed || busy || preview.summary.matchedProducts === 0}
          onClick={onImport}
        >
          {busy ? "Replacing…" : `Replace batches for ${preview.summary.matchedProducts} products`}
        </button>
      </div>
    </section>
  );
}
