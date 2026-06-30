"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import styles from "./PurchaseEntry.module.css";
import { distributors, uploadedRows } from "./purchaseData";
import { getDistributorMatches, getPurchaseTotal } from "./purchaseUtils";
import { DateField } from "@/features/events/components/purchase/DateField";
import { DistributorField } from "@/features/events/components/purchase/DistributorField";
import { PurchaseItemsTable } from "@/features/events/components/purchase/PurchaseItemsTable";
import { UploadOptions } from "@/features/events/components/purchase/UploadOptions";

export function PurchaseEntry() {
  const [distributor, setDistributor] = useState("");
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
      <div className={styles.content}>
        <div className={styles.breadcrumb}>
          <span>Purchase</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>New</span>
        </div>

        <section className={styles.panel}>
          <div className={styles.formGrid}>
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

            <div>
              <label className={styles.fieldLabel}>Bill No.</label>
              <input className={styles.inputField} placeholder="Optional" />
            </div>

            <DateField label="Bill Date" />
            <DateField label="Due Date" />
          </div>

          <UploadOptions fileRef={fileRef} hasUpload={hasUpload} onUploadReady={markUploadReady} />
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
