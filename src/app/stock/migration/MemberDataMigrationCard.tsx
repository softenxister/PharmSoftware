import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArchiveRestore,
  FileSpreadsheet,
  UploadCloud,
  Users,
} from "lucide-react";
import { MemberMigrationPreviewPanel } from "./MemberMigrationPreviewPanel";
import {
  submitMemberDataMigration,
  type MemberMigrationPreview,
  type MemberMigrationResult,
} from "./migrationClient";
import styles from "./StockMigration.module.css";

const MEMBER_HEADERS = ["รหัสสมาชิก", "ชื่อ-สกุล", "ที่อยู่", "โทรศัพท์", "เริ่มเป็นสมาชิก"];

type Props = {
  canImport: boolean;
  onStepChange: (step: 1 | 2 | 3) => void;
};

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MemberDataMigrationCard({ canImport, onStepChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MemberMigrationPreview | null>(null);
  const [result, setResult] = useState<MemberMigrationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
    onStepChange(1);
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
      setPreview(await submitMemberDataMigration<MemberMigrationPreview>("preview", file));
      setResult(null);
      setConfirmed(false);
      onStepChange(2);
    } catch (requestError) {
      setPreview(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to preview this member file.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!file || !preview || !confirmed) return;
    setBusy("import");
    setError(null);
    try {
      setResult(await submitMemberDataMigration<MemberMigrationResult>("import", file, preview.confirmationToken));
      onStepChange(3);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this member file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <article className={`${styles.activeDataset} ${styles.memberDataset}`}>
        <div className={styles.datasetHeader}>
          <span className={styles.datasetIcon}><Users size={21} /></span>
          <div><h3>Member data</h3><p>Member code, name, address, phone, and membership start date.</p></div>
          <span className={styles.availableBadge}>Available</span>
        </div>
        <div className={styles.headerMap}>
          <span>Recognized member headers</span>
          <div>{MEMBER_HEADERS.map((header) => <code key={header}>{header}</code>)}</div>
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
          <div><strong>Drop the UTF-8 member CSV here</strong><p>CSV only · UTF-8 · maximum 5 MB · preview required before import</p></div>
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

      {error && <div ref={errorRef} className={styles.errorNotice} role="alert"><ArchiveRestore size={18} /><span><strong>Member import did not complete.</strong>{error}</span></div>}
      {preview && (
        <MemberMigrationPreviewPanel
          preview={preview}
          result={result}
          confirmed={confirmed}
          busy={busy === "import"}
          onConfirmedChange={setConfirmed}
          onImport={handleImport}
        />
      )}
    </>
  );
}
