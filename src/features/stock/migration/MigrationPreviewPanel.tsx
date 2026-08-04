import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { localizeProductUnit, localizeUnitExpression } from "@/i18n/productUnits";
import type { MigrationPreview, MigrationResult } from "./migrationClient";
import styles from "./StockMigration.module.css";

type Props = {
  preview: MigrationPreview;
  result: MigrationResult | null;
  confirmed: boolean;
  busy: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onImport: () => void;
};

const statusLabel = {
  new: "New product",
  update: "Update match",
  conflict: "Blocked",
} as const;

export function MigrationPreviewPanel({
  preview,
  result,
  confirmed,
  busy,
  onConfirmedChange,
  onImport,
}: Props) {
  const { preferences } = usePreferences();
  const baseUnitLabel = preferences.locale === "th" ? "หน่วยฐาน" : "Base unit";
  const perUnitLabel = preferences.locale === "th" ? "ต่อ" : "per";
  const importableCount = preview.summary.newCount + preview.summary.updateCount;

  if (result) {
    return (
      <section className={styles.successPanel} aria-live="polite">
        <span className={styles.successIcon}><CheckCircle2 size={22} /></span>
        <div>
          <p className={styles.eyebrow}>Import complete</p>
          <h2>{result.stockReplacedCount} stock items migrated</h2>
          <p>{result.createdCount} created, {result.updatedCount} updated, and {result.skippedConflictCount} blocked rows skipped.</p>
          <a className={styles.textLink} href="/stock">Open stock inventory <ArrowRight size={15} /></a>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.previewPanel} aria-labelledby="migration-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Review before import</p>
          <h2 id="migration-preview-title">CW stock preview</h2>
          <p>Every product is classified before anything is written.</p>
        </div>
        <div className={styles.summaryGrid} aria-label="Preview summary">
          <div><strong>{preview.summary.newCount}</strong><span>New</span></div>
          <div><strong>{preview.summary.updateCount}</strong><span>Updates</span></div>
          <div className={preview.summary.conflictCount ? styles.summaryConflict : undefined}>
            <strong>{preview.summary.conflictCount}</strong><span>Blocked</span>
          </div>
          <div className={preview.summary.brandReviewCount ? styles.summaryBrandReview : undefined}>
            <strong>{preview.summary.brandReviewCount}</strong><span>Brand review</span>
          </div>
          <div><strong>{preview.summary.totalUnits}</strong><span>Units</span></div>
        </div>
      </div>

      {preview.summary.conflictCount > 0 && (
        <div className={styles.conflictNotice} role="status">
          <AlertTriangle size={18} />
          <span>Blocked rows will not be imported. Fix barcode conflicts in the CSV or database, then preview again.</span>
        </div>
      )}
      {preview.summary.brandReviewCount > 0 && (
        <div className={styles.brandNotice} role="status">
          <AlertTriangle size={18} />
          <span>{preview.summary.brandReviewCount} products have no reliable brand match and will use “Unspecified” rather than copying the full product name.</span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.fullStockTable}>
          <thead><tr><th>Status</th><th>CW product code</th><th>Product</th><th>Generic name</th><th>Base-unit cost</th><th>Brand suggestion</th><th>Units &amp; quantity</th><th>Barcodes</th><th>Unit prices</th><th>Stock</th><th>Match</th></tr></thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.externalProductCode}>
                <td><span className={`${styles.status} ${styles[row.status]}`}>{statusLabel[row.status]}</span></td>
                <td><code>{row.externalProductCode}</code></td>
                <td><strong>{row.itemName}</strong><small>{row.baseBarcode}</small></td>
                <td>{row.genericName || "—"}</td>
                <td><strong>฿{row.lastCostThb.toLocaleString()}</strong><small>{perUnitLabel} {localizeProductUnit(preferences.locale, row.baseUnit)}</small></td>
                <td><strong>{row.brandName ?? "Review required"}</strong><small className={styles[`brand${row.brandConfidence}`]}>{row.brandConfidence === "review" ? "No reliable match" : `${row.brandConfidence} confidence${row.brandMatchedAlias ? ` · ${row.brandMatchedAlias}` : ""}`}</small></td>
                <td><div className={styles.unitList}>{row.units.map((unit) => <span key={`${unit.unitName}-${unit.quantityInBaseUnit}`}><strong>{localizeProductUnit(preferences.locale, unit.unitName)}</strong><small>{unit.isBaseUnit ? baseUnitLabel : localizeUnitExpression(preferences.locale, `${unit.quantityInBaseUnit} ${row.baseUnit}`)}</small></span>)}</div></td>
                <td><div className={styles.unitList}>{row.units.map((unit) => <span key={`${unit.unitName}-${unit.quantityInBaseUnit}`}><strong>{localizeUnitExpression(preferences.locale, `${unit.unitName}[${unit.quantityInBaseUnit}]`)}</strong><small>{unit.barcodes.join(", ")}</small></span>)}</div></td>
                <td><div className={styles.unitList}>{row.units.map((unit) => <span key={`${unit.unitName}-${unit.quantityInBaseUnit}`}><strong>฿{unit.sellPriceThb.toLocaleString()}</strong><small>{perUnitLabel} {localizeProductUnit(preferences.locale, unit.unitName)}</small></span>)}</div></td>
                <td>{row.availableStock}</td>
                <td>{row.issue ?? (row.matchReason === "externalProductCode" ? "CW product code" : row.matchedItemName ?? "Create new")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.confirmRow}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
          <span>I understand that CW quantities replace the current stock totals for imported products.</span>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!confirmed || busy || importableCount === 0} onClick={onImport}>
          {busy ? "Importing…" : `Import ${importableCount} products`}
        </button>
      </div>
    </section>
  );
}
