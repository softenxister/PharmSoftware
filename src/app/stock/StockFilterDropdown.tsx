"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import styles from "./Stock.module.css";

interface StockFilterDropdownProps {
  id: string;
  label: string;
  options: readonly string[];
  selectedOptions: string[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleOption: (option: string) => void;
  searchable?: boolean;
  helperText?: string;
}

export function StockFilterDropdown({
  id,
  label,
  options,
  selectedOptions,
  isOpen,
  onToggle,
  onToggleOption,
  searchable = true,
  helperText,
}: StockFilterDropdownProps) {
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const handleToggle = () => {
    setQuery("");
    onToggle();
  };

  return (
    <div className={styles.categoryFilterGroup}>
      <button
        type="button"
        className={styles.filterButton}
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={handleToggle}
      >
        <span className={styles.filterText}>
          <span className={styles.filterLabel}>{label}</span>
        </span>
        <span className={styles.filterButtonEnd}>
          {selectedOptions.length > 0 && (
            <span className={styles.filterCount}>{selectedOptions.length}</span>
          )}
          <ChevronDown size={16} className={isOpen ? styles.filterChevronOpen : undefined} />
        </span>
      </button>

      {isOpen && (
        <div className={styles.categoryDropdown} id={id}>
          {searchable && (
            <label className={styles.categorySearchField}>
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </label>
          )}

          <div
            className={`${styles.categoryOptions} ${!searchable ? styles.categoryOptionsCompact : ""}`}
            role="group"
            aria-label={`${label} options`}
          >
            {visibleOptions.map((option) => (
              <label className={styles.categoryOption} key={option}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => onToggleOption(option)}
                />
                <span title={option}>{option}</span>
              </label>
            ))}
            {visibleOptions.length === 0 && (
              <span className={styles.categoryEmpty}>No matching options</span>
            )}
          </div>
          {helperText && <p className={styles.filterHelperText}>{helperText}</p>}
        </div>
      )}
    </div>
  );
}

interface StockRangeFilterProps {
  isOpen: boolean;
  minimum: string;
  maximum: string;
  isValid: boolean;
  onToggle: () => void;
  onMinimumChange: (value: string) => void;
  onMaximumChange: (value: string) => void;
}

export function StockRangeFilter({
  isOpen,
  minimum,
  maximum,
  isValid,
  onToggle,
  onMinimumChange,
  onMaximumChange,
}: StockRangeFilterProps) {
  const hasRange = minimum.trim().length > 0 || maximum.trim().length > 0;

  return (
    <div className={styles.categoryFilterGroup}>
      <button
        type="button"
        className={styles.filterButton}
        aria-expanded={isOpen}
        aria-controls="stock-range-options"
        onClick={onToggle}
      >
        <span className={styles.filterText}>
          <span className={styles.filterLabel}>Stock Range</span>
        </span>
        <span className={styles.filterButtonEnd}>
          {hasRange && <span className={styles.filterCount}>1</span>}
          <ChevronDown size={16} className={isOpen ? styles.filterChevronOpen : undefined} />
        </span>
      </button>

      {isOpen && (
        <div className={styles.stockRangePanel} id="stock-range-options">
          <label className={styles.stockRangeField}>
            <span>Minimum</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={minimum}
              onChange={(event) => onMinimumChange(event.target.value)}
              placeholder="0"
            />
          </label>
          <label className={styles.stockRangeField}>
            <span>Maximum</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={maximum}
              onChange={(event) => onMaximumChange(event.target.value)}
              placeholder="Any"
            />
          </label>
          {!isValid && <p className={styles.stockRangeError}>Enter valid stock numbers with minimum ≤ maximum.</p>}
        </div>
      )}
    </div>
  );
}
