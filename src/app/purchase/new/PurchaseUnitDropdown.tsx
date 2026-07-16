"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { usePreferences } from "@/app/PreferencesProvider";
import styles from "./PurchaseEntry.module.css";

type PurchaseUnitDropdownProps = {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  showLabel?: boolean;
  onChange: (value: string) => void;
};

export function PurchaseUnitDropdown({
  label,
  value,
  options,
  disabled = false,
  showLabel = true,
  onChange,
}: PurchaseUnitDropdownProps) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter(option => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className={styles.unitDropdownField} ref={rootRef}>
      {showLabel && <span className={styles.unitDropdownLabel}>{label}</span>}
      <button
        type="button"
        className={styles.unitDropdownButton}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen(current => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span>{value || t("purchaseEntry.selectUnit")}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div className={styles.unitDropdownMenu}>
          <label className={styles.unitDropdownSearch}>
            <Search size={13} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  onChange(matches[0]);
                  setOpen(false);
                }
              }}
              placeholder={t("purchaseEntry.searchUnit")}
              aria-label={t("stock.searchFilter", { label })}
            />
          </label>
          <div className={styles.unitDropdownOptions} role="listbox" aria-label={`${label} options`}>
            {matches.length === 0 && <span className={styles.unitDropdownEmpty}>{t("purchaseEntry.noUnit")}</span>}
            {matches.map(option => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={styles.unitDropdownOption}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {option === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
