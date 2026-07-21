"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArchiveRestore,
  Check,
  ChevronRight,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  PackageSearch,
  Store,
  UploadCloud,
  Users,
} from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { invalidateStockCatalog } from "@/app/stock/stockCatalogClient";
import { MigrationPreviewPanel } from "./MigrationPreviewPanel";
import {
  submitCwMigration,
  type MigrationPreview,
  type MigrationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

const CW_HEADERS = ["รหัสสินค้า", "บาร์โค้ด", "ชื่อสินค้า(เต็ม)", "หน่วยฐาน", "หน่วยสินค้า", "จำนวนคงเหลือ", "ราคาปลีก 1"];

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function StockMigrationPage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
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
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!canImport) return;
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  async function handlePreview() {
    if (!file) return;
    setBusy("preview");
    setError(null);
    try {
      setPreview(await submitCwMigration<MigrationPreview>("preview", file));
      setConfirmed(false);
    } catch (requestError) {
      setPreview(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to preview this file.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!file || !preview || !confirmed) return;
    setBusy("import");
    setError(null);
    try {
      const imported = await submitCwMigration<MigrationResult>("import", file, preview.confirmationToken);
      invalidateStockCatalog();
      setResult(imported);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this file.");
    } finally {
      setBusy(null);
    }
  }

  const activeStep = result ? 3 : preview ? 2 : 1;

  return (
    <section className={styles.page} aria-labelledby="migration-title">
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}><span>Stock</span><ChevronRight size={13} /><span>Data migration</span></div>
          <h1 id="migration-title">Move your pharmacy data safely</h1>
          <p>Preview matches, units, barcodes, and stock quantities before they reach your inventory.</p>
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
            <span className={styles.readyBadge}>Stock import ready</span>
          </div>

          {!canImport && (
            <div className={styles.permissionNotice} role="status"><LockKeyhole size={18} />Only the pharmacy owner can import migration files.</div>
          )}

          <section className={styles.datasetSection} aria-labelledby="available-data-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CW datasets</p><h2 id="available-data-title">Choose what to migrate</h2></div><span>1 of 3 available</span></div>

            <article className={styles.activeDataset}>
              <div className={styles.datasetHeader}>
                <span className={styles.datasetIcon}><PackageSearch size={21} /></span>
                <div><h3>Stock items</h3><p>Products, all barcodes, unit sizes, unit prices, and current quantity.</p></div>
                <span className={styles.availableBadge}>Available</span>
              </div>
              <div className={styles.headerMap}>
                <span>Recognized CW headers</span>
                <div>{CW_HEADERS.map((header) => <code key={header}>{header}</code>)}</div>
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
                  <button type="button" className={styles.primaryButton} disabled={Boolean(busy)} onClick={handlePreview}>{busy === "preview" ? "Validating…" : preview ? "Preview again" : "Preview data"}</button>
                </div>
              )}
            </article>

            <div className={styles.comingSoonGrid}>
              <article className={styles.disabledDataset} aria-disabled="true">
                <span className={styles.datasetIcon}><Users size={20} /></span><div><h3>Member data</h3><p>Member details · item purchase history</p></div><span>Coming soon</span>
              </article>
              <article className={styles.disabledDataset} aria-disabled="true">
                <span className={styles.datasetIcon}><Store size={20} /></span><div><h3>Distributor data</h3><p>Distributor details · purchase history</p></div><span>Coming soon</span>
              </article>
            </div>
          </section>

          {error && <div ref={errorRef} className={styles.errorNotice} role="alert"><ArchiveRestore size={18} /><span><strong>Import did not complete.</strong>{error}</span></div>}
          {preview && <MigrationPreviewPanel preview={preview} result={result} confirmed={confirmed} busy={busy === "import"} onConfirmedChange={setConfirmed} onImport={handleImport} />}

          <aside className={styles.dataNote}><Database size={18} /><div><strong>How matching works</strong><p>The first import checks every barcode. Later CW imports use the saved CW product code first. A barcode linked to more than one product is blocked for review.</p></div></aside>
        </div>
      </div>
    </section>
  );
}
