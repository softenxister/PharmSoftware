"use client";

import { RefObject } from "react";
import { FileSpreadsheet, Phone, ScanBarcode, Upload } from "lucide-react";
import styles from "@/app/purchase/new/PurchaseEntry.module.css";

interface UploadOptionsProps {
  fileRef: RefObject<HTMLInputElement>;
  hasUpload: boolean;
  onUploadReady: () => void;
}

export function UploadOptions({ fileRef, hasUpload, onUploadReady }: UploadOptionsProps) {
  return (
    <div className={styles.uploadSection}>
      <div className={styles.optionFrame}>
        <div className={styles.optionTrack}>
          <div className={styles.uploadPane}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onUploadReady}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className={styles.uploadButton}>
              <Upload size={28} />
            </button>
            <h2 className={styles.sectionTitle}>Upload your CSV file</h2>
            <p className={styles.sectionCopy}>
              Import distributor items, lot numbers, expiry dates, prices, quantities, and free goods from one purchase bill.
            </p>
          </div>

          <div className={styles.scanPane}>
            <div className={styles.phone}>
              <div className={styles.phoneSpeaker} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneTop}>
                  <Phone size={13} color="#47745a" />
                  <span className={styles.scanLabel}>SCAN</span>
                </div>
                <div className={styles.barcodeBox}>
                  <ScanBarcode size={36} color="#2f7c4e" />
                </div>
                <div className={styles.phoneLinePrimary} />
                <div className={styles.phoneLineSecondary} />
              </div>
            </div>
            <div className={styles.scannerCopy}>
              <div className={styles.iconBadge}>
                <ScanBarcode size={19} color="#2f7c4e" />
              </div>
              <h2 className={styles.sectionTitle}>Scan barcode from your phone</h2>
              <p className={styles.sectionCopy}>
                Use the phone scanner option when items arrive without a ready CSV. Scan each item and confirm the matched product before saving.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!hasUpload && (
        <button type="button" onClick={onUploadReady} className={styles.previewButton}>
          <FileSpreadsheet size={14} />
          Preview uploaded CSV table
        </button>
      )}
    </div>
  );
}
