import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import styles from "./SearchableSelect.module.css";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  ariaLabel: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  allowCustom?: boolean;
  customOptionLabel?: (value: string) => string;
  onCommit?: () => void;
  compact?: boolean;
};

export function SearchableSelect({
  ariaLabel,
  value,
  options,
  onChange,
  allowCustom = false,
  customOptionLabel,
  onCommit,
  compact = false,
}: SearchableSelectProps) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = search.trim().toLowerCase();
  const filteredOptions = options.filter((option) => (
    option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
  ));
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const customValue = search.trim();

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
    window.setTimeout(() => onCommit?.(), 0);
  };

  const openWithEmptySearch = () => {
    setSearch("");
    setOpen(true);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={`${styles.control} ${compact ? styles.controlCompact : ""}`}>
        <input
          ref={inputRef}
          type="text"
          value={open ? search : selectedLabel}
          placeholder={selectedLabel || t("stockForm.select")}
          readOnly={!open}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onFocus={openWithEmptySearch}
          onClick={openWithEmptySearch}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (open && filteredOptions[0]) {
                choose(filteredOptions[0].value);
              } else if (open && allowCustom && customValue) {
                choose(customValue);
              } else {
                setOpen(true);
              }
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setSearch("");
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          aria-label={t("stockForm.open", { label: ariaLabel })}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              openWithEmptySearch();
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <ChevronDown className={open ? styles.chevronOpen : ""} size={16} strokeWidth={2.2} />
        </button>
      </div>

      {open && (
        <div className={styles.menu}>
          <div className={styles.options} role="listbox" aria-label={ariaLabel}>
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            ))}
            {allowCustom
              && customValue
              && filteredOptions.every(({ value: optionValue }) => (
                optionValue.toLowerCase() !== customValue.toLowerCase()
              )) && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(customValue)}
                >
                  {customOptionLabel
                    ? customOptionLabel(customValue)
                    : t("stockForm.useValue", { value: customValue })}
                </button>
              )}
            {filteredOptions.length === 0 && (!allowCustom || !customValue) && (
              <span className={styles.empty}>{t("stockForm.noMatch")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
