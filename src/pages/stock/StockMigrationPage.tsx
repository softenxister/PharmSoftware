import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArchiveRestore,
  Check,
  ChevronRight,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  PackageSearch,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { invalidateStockCatalog } from "@/api/stockCatalogClient";
import { MigrationPreviewPanel } from "@/features/stock/migration/MigrationPreviewPanel";
import { StockDetailUpdatePreviewPanel } from "@/features/stock/migration/StockDetailUpdatePreviewPanel";
import { MemberDataMigrationCard } from "@/features/stock/migration/MemberDataMigrationCard";
import { LotExpiryMigrationCard } from "@/features/stock/migration/LotExpiryMigrationCard";
import { DistributorDataMigrationCard } from "@/features/stock/migration/DistributorDataMigrationCard";
import { CustomerPurchaseHistoryMigrationCard } from "@/features/stock/migration/CustomerPurchaseHistoryMigrationCard";
import { ProductCategoryNormalizationCard } from "@/features/stock/migration/ProductCategoryNormalizationCard";
import { ProductMeasurementNormalizationCard } from "@/features/stock/migration/ProductMeasurementNormalizationCard";
import {
  submitCwMigration,
  type CwMigrationMode,
  type CwMigrationPreview,
  type CwMigrationResult,
} from "@/features/stock/migration/migrationClient";
import styles from "@/features/stock/migration/StockMigration.module.css";

const FULL_CW_HEADERS = ["รหัสสินค้า", "บาร์โค้ด", "ชื่อสินค้า(เต็ม)", "หน่วยฐาน", "ชื่อสามัญ", "ราคาทุนรับหลังสุด", "หน่วยสินค้า", "จำนวนคงเหลือ", "ราคาปลีก 1"];
const DETAIL_UPDATE_HEADERS = ["รหัสสินค้า", "ชื่อสามัญ", "ราคาทุนรับหลังสุด"];

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function StockMigrationPage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CwMigrationMode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CwMigrationPreview | null>(null);
  const [result, setResult] = useState<CwMigrationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const canImport = Boolean(user?.canManageStock);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    setActiveStep(1);
  }

  function selectMode(nextMode: CwMigrationMode) {
    setMode(nextMode);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    setActiveStep(1);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!canImport) return;
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  async function handlePreview() {
    if (!file || !mode) return;
    setBusy("preview");
    setError(null);
    try {
      setPreview(await submitCwMigration<CwMigrationPreview>("preview", mode, file));
      setConfirmed(false);
      setActiveStep(2);
    } catch (requestError) {
      setPreview(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to preview this file.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!file || !mode || !preview || preview.mode !== mode || !confirmed) return;
    setBusy("import");
    setError(null);
    try {
      const imported = await submitCwMigration<CwMigrationResult>("import", mode, file, preview.confirmationToken);
      invalidateStockCatalog();
      setResult(imported);
      setActiveStep(3);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="migration-title">
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}><span>Stock</span><ChevronRight size={13} /><span>Data migration</span></div>
          <h1 id="migration-title">Move your pharmacy data safely</h1>
          <p>Preview product, member, distributor, and customer purchase-history records before they reach your pharmacy database.</p>
        </div>
        <div className={styles.secureBadge}><LockKeyhole size={15} /><span>Owner-only import</span></div>
      </header>

      <div className={styles.scrollArea}>
        <div className={styles.content}>
          <ol className={styles.steps} aria-label="Migration progress">
            {["Upload", "Review", "Import"].map((label, index) => {
              const step = index + 1;
              return <li key={label} className={activeStep >= step ? styles.stepActive : undefined}><span>{activeStep > step ? <Check size={14} /> : step}</span>{label}</li>;
            })}
          </ol>

          <div className={styles.sourceBar}>
            <span className={styles.sourceLogo}>CW</span>
            <div><p className={styles.eyebrow}>Selected source</p><h2>CW pharmacy software</h2></div>
            <span className={styles.readyBadge}>All CW imports ready</span>
          </div>

          {!canImport && (
            <div className={styles.permissionNotice} role="status"><LockKeyhole size={18} />Only the pharmacy owner can import migration files.</div>
          )}

          <section className={styles.datasetSection} aria-labelledby="available-data-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CW datasets</p><h2 id="available-data-title">Choose what to migrate</h2></div><span>5 of 5 available</span></div>

            <article className={styles.activeDataset}>
              <div className={styles.datasetHeader}>
                <span className={styles.datasetIcon}><PackageSearch size={21} /></span>
                <div><h3>Stock items</h3><p>Products, all barcodes, unit sizes, unit prices, and current quantity.</p></div>
                <span className={styles.availableBadge}>Available</span>
              </div>
              <div className={styles.modeSelector} aria-label="Stock import mode">
                <button
                  type="button"
                  className={mode === "full" ? styles.modeSelected : undefined}
                  aria-pressed={mode === "full"}
                  disabled={!canImport || Boolean(busy)}
                  onClick={() => selectMode("full")}
                >
                  <strong>Full stock import</strong>
                  <span>Initial setup · imports identity, packaging, prices, stock, generic name, and cost</span>
                </button>
                <button
                  type="button"
                  className={mode === "generic-cost-update" ? styles.modeSelected : undefined}
                  aria-pressed={mode === "generic-cost-update"}
                  disabled={!canImport || Boolean(busy)}
                  onClick={() => selectMode("generic-cost-update")}
                >
                  <strong>Update generic name &amp; latest cost</strong>
                  <span>Matches exact CW item code · changes only columns G and I</span>
                </button>
              </div>
              <div className={styles.headerMap}>
                <span>Recognized CW headers</span>
                <div>{(mode === "generic-cost-update" ? DETAIL_UPDATE_HEADERS : FULL_CW_HEADERS).map((header) => <code key={header}>{header}</code>)}</div>
              </div>
              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ""}`}
                onDragEnter={(event) => { event.preventDefault(); if (canImport) setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={dropFile}
              >
                <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} disabled={!canImport || Boolean(busy)} />
                <span className={styles.uploadIcon}><UploadCloud size={24} /></span>
                <div><strong>Drop the CW stock CSV here</strong><p>CSV only · maximum 5 MB · nothing imports until you confirm</p></div>
                <button type="button" className={styles.secondaryButton} disabled={!canImport || Boolean(busy)} onClick={() => inputRef.current?.click()}>Choose CSV</button>
              </div>
              {file && (
                <div className={styles.fileRow}>
                  <span className={styles.fileIcon}><FileSpreadsheet size={20} /></span>
                  <div><strong>{file.name}</strong><small>{fileSize(file.size)}</small></div>
                  <button type="button" className={styles.linkButton} disabled={Boolean(busy)} onClick={() => selectFile(null)}>Remove</button>
                  <button type="button" className={styles.primaryButton} disabled={Boolean(busy) || !mode} onClick={handlePreview}>{busy === "preview" ? "Validating…" : preview ? "Preview again" : mode ? "Preview data" : "Choose import mode"}</button>
                </div>
              )}
            </article>

            <LotExpiryMigrationCard canImport={canImport} onStepChange={setActiveStep} />
            <MemberDataMigrationCard canImport={canImport} onStepChange={setActiveStep} />
            <CustomerPurchaseHistoryMigrationCard canImport={canImport} onStepChange={setActiveStep} />
            <DistributorDataMigrationCard canImport={canImport} onStepChange={setActiveStep} />
          </section>

          <ProductMeasurementNormalizationCard canNormalize={canImport} />
          <ProductCategoryNormalizationCard canNormalize={canImport} />

          {error && <div ref={errorRef} className={styles.errorNotice} role="alert"><ArchiveRestore size={18} /><span><strong>Import did not complete.</strong>{error}</span></div>}
          {preview?.mode === "full" && (
            <MigrationPreviewPanel
              preview={preview}
              result={result?.mode === "full" ? result : null}
              confirmed={confirmed}
              busy={busy === "import"}
              onConfirmedChange={setConfirmed}
              onImport={handleImport}
            />
          )}
          {preview?.mode === "generic-cost-update" && (
            <StockDetailUpdatePreviewPanel
              preview={preview}
              result={result?.mode === "generic-cost-update" ? result : null}
              confirmed={confirmed}
              busy={busy === "import"}
              onConfirmedChange={setConfirmed}
              onImport={handleImport}
            />
          )}

          <aside className={styles.dataNote}><Database size={18} /><div><strong>How matching works</strong><p>Full stock import uses CW product codes and barcodes. Generic-name and latest-cost update uses only the exact CW product code from the product row; its cost is for that product’s base unit. Lot, expiry, and customer purchase history also require exact CW product-code matches. Members update by member code. Distributors match by CW code first, then exact name.</p></div></aside>
        </div>
      </div>
    </section>
  );
}
