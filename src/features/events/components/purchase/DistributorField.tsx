"use client";

import { Search } from "lucide-react";
import styles from "@/app/purchase/PurchaseEntry.module.css";

interface DistributorFieldProps {
  matches: string[];
  value: string;
  showMatches: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (value: string) => void;
}

export function DistributorField({
  matches,
  value,
  showMatches,
  onChange,
  onFocus,
  onSelect,
}: DistributorFieldProps) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>Distributor</label>
      <div className={styles.field}>
        <div className={styles.searchIconBox}>
          <Search size={16} color="#47745a" />
        </div>
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder="Enter distributor"
          className={styles.fieldInput}
        />
      </div>
      {showMatches && matches.length > 0 && (
        <div className={styles.matchList}>
          {matches.map(name => (
            <button
              key={name}
              type="button"
              className={styles.matchButton}
              onMouseDown={() => onSelect(name)}
            >
              <span>{name}</span>
              <span className={styles.matchMeta}>match</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
