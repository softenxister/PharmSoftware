"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight, PackagePlus, Search } from "lucide-react";
import styles from "./PurchaseEntry.module.css";
import { distributors, uploadedRows } from "./purchaseData";
import { getDistributorMatches, getPurchaseTotal } from "./purchaseUtils";
import { DateField } from "@/features/events/components/purchase/DateField";
import { DistributorField } from "@/features/events/components/purchase/DistributorField";
import { PurchaseItemsTable } from "@/features/events/components/purchase/PurchaseItemsTable";
import { UploadOptions } from "@/features/events/components/purchase/UploadOptions";

export function PurchaseEntry() {
  const [distributor, setDistributor] = useState("");
  const [manualItem, setManualItem] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [hasUpload, setHasUpload] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => getDistributorMatches(distributors, distributor),
    [distributor],
  );

  const total = getPurchaseTotal(uploadedRows);

  const markUploadReady = () => {
    setHasUpload(true);
    setSaved(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <span>Purchase</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>New purchase</span>
        </div>
        <button type="button" className={styles.saveButton} disabled={!hasUpload && manualItem.trim().length === 0}>
          <PackagePlus size={16} />
          Save purchase
        </button>
      </div>

      <div className={styles.content}>
        <section className={styles.detailsPanel} aria-label="Purchase bill details">
          <div className={styles.panelHeader}>
            <div>
              <h1 className={styles.panelTitle}>New purchase bill</h1>
              <p className={styles.panelSubtitle}>Choose distributor, upload CSV, scan, or key items manually.</p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.distributorColumn}>
              <DistributorField
                value={distributor}
                matches={matches}
                showMatches={showMatches}
                onChange={value => {
                  setDistributor(value);
                  setShowMatches(true);
                  setSaved(false);
                }}
                onFocus={() => setShowMatches(true)}
                onSelect={value => {
                  setDistributor(value);
                  setShowMatches(false);
                }}
              />
            </div>

            <div>
              <label className={styles.fieldLabel}>Bill No.</label>
              <input className={styles.inputField} placeholder="Optional" />
            </div>

            <DateField label="Bill Date" />
            <DateField label="Due Date" />
          </div>

          <UploadOptions fileRef={fileRef} hasUpload={hasUpload} onUploadReady={markUploadReady} />
        </section>

        <section className={styles.manualPanel} aria-label="Manual purchase item input">
          <div className={styles.manualHeader}>
            <div>
              <h2 className={styles.manualTitle}>Manual item entry</h2>
              <p className={styles.manualSubtitle}>Use this when the distributor has no CSV file.</p>
            </div>
            <span className={styles.manualBadge}>One-by-one input</span>
          </div>

          <div className={styles.manualSearchRow}>
            <label className={styles.manualSearch}>
              <Search size={17} className={styles.manualSearchIcon} />
              <input
                type="text"
                value={manualItem}
                onChange={(event) => setManualItem(event.target.value)}
                placeholder="Scan barcode or search item name to add purchase line"
              />
            </label>
            <button type="button" className={styles.addLineButton} disabled={manualItem.trim().length === 0}>
              <PackagePlus size={16} />
              Add line
            </button>
          </div>

          <div className={styles.manualLineGrid}>
            <label className={styles.compactField}>
              <span>Lot No.</span>
              <input type="text" />
            </label>
            <label className={styles.compactField}>
              <span>Exp. Date</span>
              <input type="text" placeholder="dd/mm/yyyy" />
            </label>
            <label className={styles.compactField}>
              <span>Cost</span>
              <input type="text" inputMode="decimal" />
            </label>
            <label className={styles.compactField}>
              <span>Sell</span>
              <input type="text" inputMode="decimal" />
            </label>
            <label className={styles.compactField}>
              <span>Qty</span>
              <input type="text" inputMode="numeric" />
            </label>
            <label className={styles.compactField}>
              <span>Free</span>
              <input type="text" inputMode="numeric" />
            </label>
          </div>
        </section>

        {hasUpload && (
          <PurchaseItemsTable
            rows={uploadedRows}
            saved={saved}
            total={total}
            onSave={() => setSaved(true)}
          />
        )}
      </div>
    </div>
  );
}
