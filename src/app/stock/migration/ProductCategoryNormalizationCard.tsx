"use client";

import { CheckCircle2, RefreshCw, Tags } from "lucide-react";
import { useState } from "react";
import { invalidateStockCatalog } from "@/app/stock/stockCatalogClient";
import {
  submitProductCategoryNormalization,
  type ProductCategoryNormalizationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

type ProductCategoryNormalizationCardProps = {
  canNormalize: boolean;
};

export function ProductCategoryNormalizationCard({
  canNormalize,
}: ProductCategoryNormalizationCardProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProductCategoryNormalizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleNormalize() {
    const confirmed = window.confirm(
      "Normalize every product category using the current server rules?\n\n"
      + "Confident matches may replace existing categories. Items without a confident match "
      + "will keep their current category.",
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const normalized = await submitProductCategoryNormalization();
      invalidateStockCatalog();
      setResult(normalized);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Product categories could not be normalized.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.normalizationSection} aria-labelledby="category-normalization-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Database maintenance</p>
          <h2 id="category-normalization-title">Product categories</h2>
        </div>
      </div>

      <div className={styles.normalizationCard} aria-busy={busy}>
        <span className={styles.datasetIcon} aria-hidden="true"><Tags size={21} /></span>
        <div className={styles.normalizationCopy}>
          <h3>Apply current normalization rules</h3>
          <p>
            Re-evaluate every item using the terms deployed in
            {" "}<code>productCategoryNormalization.ts</code>. Confident matches replace the
            stored category; unmatched items keep their current category.
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
          <strong>Category normalization complete</strong>
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
