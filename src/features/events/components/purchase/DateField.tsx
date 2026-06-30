"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import styles from "@/app/purchase/PurchaseEntry.module.css";
import { formatDateDisplay } from "@/app/purchase/purchaseUtils";

export function DateField({ label }: { label: string }) {
  const [displayDate, setDisplayDate] = useState("");
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (pickerRef.current?.showPicker) {
      pickerRef.current.showPicker();
      return;
    }

    pickerRef.current?.click();
  };

  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={`${styles.field} ${styles.fieldGroup}`}>
        <button
          type="button"
          onClick={openPicker}
          className={styles.dateButton}
          aria-label={`Open ${label.toLowerCase()} calendar`}
        >
          <CalendarDays size={15} color="#47745a" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={displayDate}
          onChange={event => setDisplayDate(event.target.value)}
          placeholder="dd/mm/yy"
          className={styles.fieldInput}
        />
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          onChange={event => setDisplayDate(formatDateDisplay(event.target.value))}
          className={styles.hiddenDateInput}
        />
      </div>
    </div>
  );
}
