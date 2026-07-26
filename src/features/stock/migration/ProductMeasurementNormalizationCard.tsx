import { CheckCircle2, RefreshCw, Ruler } from "lucide-react";
import { useState } from "react";
import { invalidateStockCatalog } from "@/api/stockCatalogClient";
import {
  submitProductMeasurementNormalization,
  type ProductMeasurementNormalizationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

type ProductMeasurementNormalizationCardProps = {
  canNormalize: boolean;
};

export function ProductMeasurementNormalizationCard({
  canNormalize,
}: ProductMeasurementNormalizationCardProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProductMeasurementNormalizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleNormalize() {
    const confirmed = window.confirm(
      "Write extracted item measurements to the database?\n\n"
      + "Confident matches will update amount, subunit, and pack label. The selling package "
      + "(for example, blister pack or bottle) and items without a confident match will stay unchanged.",
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const normalized = await submitProductMeasurementNormalization();
      invalidateStockCatalog();
      setResult(normalized);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Product measurements could not be normalized.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.normalizationSection} aria-labelledby="measurement-normalization-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Database maintenance</p>
          <h2 id="measurement-normalization-title">Item measurements</h2>
        </div>
      </div>

      <div className={styles.normalizationCard} aria-busy={busy}>
        <span className={styles.datasetIcon} aria-hidden="true"><Ruler size={21} /></span>
        <div className={styles.normalizationCopy}>
          <h3>Save extracted amounts and subunits</h3>
          <p>
            Extract measurements such as <code>10 tablets</code>, <code>100 ml</code>, or
            {" "}<code>200 g</code> from item names and save them to the database. Selling package
            units remain unchanged.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!canNormalize || busy}
          onClick={handleNormalize}
        >
          <RefreshCw size={15} aria-hidden="true" className={busy ? styles.spinningIcon : undefined} />
          {busy ? "Normalizing…" : "Normalize"}
        </button>
      </div>

      {!canNormalize && (
        <p className={styles.normalizationHint}>Only the pharmacy owner can run this operation.</p>
      )}
      {error && <div className={styles.normalizationError} role="alert">{error}</div>}
      {result && (
        <div className={styles.normalizationResult} role="status" aria-live="polite">
          <CheckCircle2 size={19} aria-hidden="true" />
          <strong>Measurement normalization complete</strong>
          <dl>
            <div><dt>Evaluated</dt><dd>{result.evaluatedCount}</dd></div>
            <div><dt>Changed</dt><dd>{result.changedCount}</dd></div>
            <div><dt>Unchanged</dt><dd>{result.unchangedCount}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}
