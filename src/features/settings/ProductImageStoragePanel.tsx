import { useState } from "react";
import { CircleAlert, Download, ShieldCheck } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { invalidateStockCatalog } from "@/api/stockCatalogClient";
import {
  storeExternalProductImages,
  type BulkProductImageStorageResult,
} from "./productImageStorageClient";
import styles from "./Settings.module.css";

export function ProductImageStoragePanel() {
  const { t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedItems, setFailedItems] = useState<BulkProductImageStorageResult["failedItems"]>([]);

  const storeExternalPhotos = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setFailedItems([]);
    try {
      const result = await storeExternalProductImages();
      setNotice(t("productImages.storageRunSummary", {
        processed: result.processedCount,
        eligible: result.eligibleCount,
        stored: result.storedCount,
        repaired: result.repairedCount,
        failed: result.failedCount,
        remaining: result.remainingCount,
        warnings: result.cleanupWarningCount,
      }));
      setFailedItems(result.failedItems);
      invalidateStockCatalog();
    } catch (storageError) {
      setError(storageError instanceof Error
        ? storageError.message
        : t("productImages.storageError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{t("settings.productImages")}</h2>
          <p className={styles.panelDescription}>{t("productImages.description")}</p>
        </div>
      </div>

      <div className={styles.imageStorageBody}>
        <div className={styles.ownerOnlyNotice}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            <strong>{t("productImages.ownerOnly")}</strong>{" "}
            {t("productImages.ownerOnlyHint")}
          </span>
        </div>

        <article className={styles.imageStorageCard}>
          <div className={styles.imageStorageCopy}>
            <Download size={19} aria-hidden="true" />
            <div>
              <h3>{t("productImages.storageTitle")}</h3>
              <p>{t("productImages.storageDescription")}</p>
              <small>{t("productImages.batchLimit")}</small>
            </div>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void storeExternalPhotos()}
            disabled={busy}
          >
            {busy
              ? t("productImages.storingExternal")
              : t("productImages.storeExternalAction")}
          </button>
        </article>

        {error && <div className={styles.formError} role="alert">{error}</div>}
        {notice && <div className={styles.imageStorageNotice} role="status">{notice}</div>}
        {failedItems.length > 0 && (
          <section
            className={styles.imageStorageFailureLog}
            role="log"
            aria-live="polite"
            aria-labelledby="product-image-failure-log-title"
          >
            <div className={styles.imageStorageFailureHeader}>
              <CircleAlert size={17} aria-hidden="true" />
              <div>
                <h3 id="product-image-failure-log-title">
                  {t("productImages.failureLogTitle", { count: failedItems.length })}
                </h3>
                <p>{t("productImages.failureLogHint")}</p>
              </div>
            </div>
            <ul
              className={styles.imageStorageFailureList}
              aria-label={t("productImages.failureLogLabel")}
            >
              {failedItems.map((item) => (
                <li key={item.productId}>
                  <span title={item.itemName}>{item.itemName}</span>
                  <small>{t("productImages.failureLogStatus")}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
