import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type {
  CustomerPurchaseHistoryMigrationPreview,
  CustomerPurchaseHistoryMigrationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: CustomerPurchaseHistoryMigrationPreview;
  result: CustomerPurchaseHistoryMigrationResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  matched: "Ready",
  duplicate: "Duplicate",
  unmatched_customer: "No customer",
  unmatched_product: "No product",
  conflict: "Blocked",
} as const;

const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
const moneyFormatter = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function reportPeriod(preview: CustomerPurchaseHistoryMigrationPreview): string {
  const { startedAt, endedAt } = preview.reportPeriod;
  if (!startedAt || !endedAt) return "Report period was not found; import time will be used for history ordering.";
  return `Report period ${new Date(startedAt).toLocaleDateString("th-TH")} – ${new Date(endedAt).toLocaleDateString("th-TH")}.`;
}

export function CustomerPurchaseHistoryPreviewPanel({
  preview,
  result,
  confirmed,
  busy,
  onConfirmedChange,
  onImport,
}: Props) {
  const skippedCount = preview.summary.duplicateCount
    + preview.summary.unmatchedCustomerCount
    + preview.summary.unmatchedProductCount
    + preview.summary.conflictCount;

  if (result) {
    return (
      <section className={styles.successPanel} aria-live="polite">
        <span className={styles.successIcon}><CheckCircle2 size={22} /></span>
        <div>
          <p className={styles.eyebrow}>Purchase-history import complete</p>
          <h2>{result.importedCount} item-history rows imported</h2>
          <p>
            {result.skippedDuplicateCount} duplicates, {result.skippedUnmatchedCustomerCount} missing-customer rows,
            {" "}{result.skippedUnmatchedProductCount} missing-product rows, and {result.skippedConflictCount} blocked rows skipped.
          </p>
          <a className={styles.textLink} href="/member">Open member directory <ArrowRight size={15} /></a>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.previewPanel} aria-labelledby="customer-purchase-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before import</p>
          <h2 id="customer-purchase-preview-title">Customer purchase-history preview</h2>
          <p>{reportPeriod(preview)}</p>
        </div>
        <div className={`${styles.summaryGrid} ${styles.purchaseHistorySummary}`} aria-label="Purchase-history preview summary">
          <div><strong>{preview.summary.totalRows}</strong><span>Total</span></div>
          <div><strong>{preview.summary.matchedCount}</strong><span>Ready</span></div>
          <div className={preview.summary.duplicateCount ? styles.summaryBrandReview : undefined}><strong>{preview.summary.duplicateCount}</strong><span>Duplicate</span></div>
          <div className={preview.summary.unmatchedCustomerCount ? styles.summaryConflict : undefined}><strong>{preview.summary.unmatchedCustomerCount}</strong><span>No customer</span></div>
          <div className={preview.summary.unmatchedProductCount ? styles.summaryConflict : undefined}><strong>{preview.summary.unmatchedProductCount}</strong><span>No product</span></div>
          <div className={preview.summary.conflictCount ? styles.summaryConflict : undefined}><strong>{preview.summary.conflictCount}</strong><span>Blocked</span></div>
        </div>
      </div>

      {skippedCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>{skippedCount} rows will be skipped. The table shows the Excel row and missing or invalid code for correction.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.purchaseHistoryTable}>
          <thead>
            <tr><th>Status</th><th>Row</th><th>Customer</th><th>Product</th><th>Unit</th><th>Amount</th><th>Total buy</th><th>Import note</th></tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={`${row.rowNumber}-${row.customerCode}-${row.externalProductCode}`}>
                <td><span className={`${styles.status} ${styles[row.status]}`}>{statusLabel[row.status]}</span></td>
                <td>{row.rowNumber}</td>
                <td><code>{row.customerCode || "—"}</code><small title={row.matchedCustomerName ?? row.customerName}>{(row.matchedCustomerName ?? row.customerName) || "—"}</small></td>
                <td><code>{row.externalProductCode || "—"}</code><strong title={row.matchedItemName ?? row.sourceItemName}>{(row.matchedItemName ?? row.sourceItemName) || "—"}</strong></td>
                <td>{row.unit || "—"}</td>
                <td>{numberFormatter.format(row.quantity)}</td>
                <td>฿{moneyFormatter.format(row.totalAmount)}</td>
                <td><span className={styles.memberIssue}>{row.issue ?? "Customer and product codes matched."}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
          <span>I reviewed the preview. Import ready rows and skip duplicates, missing codes, and blocked rows.</span>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!confirmed || busy || preview.summary.matchedCount === 0} onClick={onImport}>
          {busy ? "Importing…" : `Import ${preview.summary.matchedCount} history rows`}
        </button>
      </div>
    </section>
  );
}
