"use client";

import { Search } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import styles from "@/app/purchase/new/PurchaseEntry.module.css";

interface DistributorFieldProps {
  matches: string[];
  value: string;
  showMatches: boolean;
  highlightedIndex: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onHighlight: (index: number) => void;
  onSelect: (value: string) => void;
}

export function DistributorField({
  matches,
  value,
  showMatches,
  highlightedIndex,
  onChange,
  onFocus,
  onKeyDown,
  onHighlight,
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
          onKeyDown={onKeyDown}
          placeholder="Enter distributor"
          className={styles.fieldInput}
        />
      </div>
      {showMatches && matches.length > 0 && (
        <div className={styles.matchList}>
          {matches.map((name, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={name}
                type="button"
                className={`${styles.matchButton} ${isHighlighted ? styles.matchButtonActive : ""}`}
                aria-selected={isHighlighted}
                onMouseEnter={() => onHighlight(index)}
                onMouseMove={() => onHighlight(index)}
                onMouseDown={() => onSelect(name)}
              >
                <span>{name}</span>
                <span className={styles.matchMeta}>match</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
