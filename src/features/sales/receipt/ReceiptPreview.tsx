import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, ReceiptText } from "lucide-react";
import { useParams, useSearchParams } from "react-router";
import { useStorePosSettings } from "@/hooks/useStorePosSettings";
import type { ReceiptPaperSize } from "@/lib/receipt";
import styles from "./ReceiptPreview.module.css";
import { loadHardware, pdfBlobBase64, printCounterPdf } from '@/features/hardware/counterHardware';

type ReceiptMetadata = {
  saleId: string;
  billNo: string;
  isLegacy: boolean;
};

export default function ReceiptPreview() {
  const { saleId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { settings: storeSettings } = useStorePosSettings();
  const requestedPaper = searchParams.get("paper");
  const [paperOverride, setPaperOverride] = useState<ReceiptPaperSize | null>(
    requestedPaper === "58" || requestedPaper === "80" ? requestedPaper : null,
  );
  const paper: ReceiptPaperSize = paperOverride ?? storeSettings.paperSize;
  const [receipt, setReceipt] = useState<ReceiptMetadata | null>(null);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfObjectUrl, setPdfObjectUrl] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [printError, setPrintError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const encodedSaleId = encodeURIComponent(saleId);
  const pdfUrl = useMemo(
    () => `/api/sales/receipt/pdf?saleId=${encodedSaleId}&paper=${paper}`,
    [encodedSaleId, paper],
  );

  useEffect(() => {
    let cancelled = false;
    setError("");
    setReceipt(null);
    fetch(`/api/sales/receipt?saleId=${encodedSaleId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { receipt?: ReceiptMetadata; error?: string };
        if (!response.ok || !data.receipt) throw new Error(data.error || "ไม่สามารถเปิดใบเสร็จได้");
        if (!cancelled) setReceipt(data.receipt);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "ไม่สามารถเปิดใบเสร็จได้");
      });
    return () => {
      cancelled = true;
    };
  }, [encodedSaleId]);

  useEffect(() => {
    if (!receipt) return;
    let active = true;
    let nextObjectUrl = "";
    setError("");
    setPdfLoading(true);
    setPdfObjectUrl("");
    fetch(pdfUrl, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(data?.error || "ไม่สามารถสร้างเอกสาร PDF ได้");
        }
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("รูปแบบเอกสารใบเสร็จไม่ถูกต้อง");
        nextObjectUrl = URL.createObjectURL(blob);
        if (active) setPdfObjectUrl(nextObjectUrl);
      })
      .catch((reason: unknown) => {
        if (active) {
          setPdfLoading(false);
          setError(reason instanceof Error ? reason.message : "ไม่สามารถสร้างเอกสาร PDF ได้");
        }
      });
    return () => {
      active = false;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [pdfUrl, receipt]);

  const choosePaper = (nextPaper: ReceiptPaperSize) => {
    setPdfLoading(true);
    setPaperOverride(nextPaper);
  };

  const browserPrint = () => {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };
  const print = async () => {
    if (printing || !pdfObjectUrl || pdfLoading) return;
    setPrintError(''); setPrintMessage('');
    const hardware = loadHardware();
    if (!hardware.printer) { browserPrint(); return; }
    setPrinting(true);
    try {
      const response = await fetch(pdfObjectUrl);
      if (!response.ok) throw new Error('Unable to read the receipt PDF.');
      await printCounterPdf(await pdfBlobBase64(await response.blob()), hardware.printer);
      setPrintMessage(`Receipt submitted to ${hardware.printer}. Check the printer for output.`);
    } catch (reason) {
      setPrintError(reason instanceof Error ? reason.message : String(reason));
    } finally { setPrinting(false); }
  };

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <span className={styles.receiptIcon} aria-hidden="true"><ReceiptText size={19} /></span>
          <div className={styles.identityText}>
            <h1>ตัวอย่างใบเสร็จ</h1>
            <p>{receipt?.billNo ?? "กำลังโหลดข้อมูลใบเสร็จ..."}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <div className={styles.paperSwitch} role="group" aria-label="เลือกขนาดกระดาษ">
            {(["58", "80"] as const).map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={paper === size}
                className={paper === size ? styles.paperActive : ""}
                onClick={() => choosePaper(size)}
              >
                {size} มม.
              </button>
            ))}
          </div>
          <a
            className={styles.secondaryAction}
            href={`${pdfUrl}&download=1`}
            aria-disabled={!receipt}
            onClick={(event) => { if (!receipt) event.preventDefault(); }}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลด PDF
          </a>
          <button type="button" className={styles.printAction} onClick={() => void print()} disabled={!receipt || pdfLoading || !pdfObjectUrl || printing}>
            <Printer size={16} aria-hidden="true" />
            {printing ? 'กำลังส่ง…' : 'พิมพ์'}
          </button>
        </div>
      </header>

      {printMessage && <p className={styles.legacyNotice} role="status">{printMessage}</p>}
      {printError && <div className={styles.legacyNotice} role="alert">{printError} <button type="button" onClick={browserPrint} disabled={pdfLoading || !pdfObjectUrl}>Open browser print dialog</button></div>}

      {receipt?.isLegacy && (
        <p className={styles.legacyNotice} role="status">
          ใบเสร็จเก่า: ตัวอย่างนี้สร้างจากข้อมูลการขายเดิมและข้อมูลร้านปัจจุบัน โปรดตรวจสอบก่อนพิมพ์
        </p>
      )}

      <section className={styles.previewArea} aria-label="ตัวอย่างเอกสาร PDF">
        {error ? (
          <div className={styles.error} role="alert">
            <strong>ไม่สามารถแสดงใบเสร็จ</strong>
            <span>{error}</span>
          </div>
        ) : receipt ? (
          <div className={styles.paperFrame} data-paper={paper}>
            {pdfLoading && <div className={styles.loading}>กำลังสร้างเอกสาร PDF...</div>}
            {pdfObjectUrl && (
              <iframe
                key={pdfObjectUrl}
                ref={iframeRef}
                className={styles.pdfFrame}
                src={pdfObjectUrl}
                title={`ใบเสร็จ ${receipt.billNo}`}
                onLoad={() => setPdfLoading(false)}
              />
            )}
          </div>
        ) : (
          <div className={styles.loadingState}>กำลังเตรียมใบเสร็จ...</div>
        )}
      </section>
    </main>
  );
}
