import { Search } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import styles from "@/features/purchase/new/PurchaseEntry.module.css";

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
  const { t } = usePreferences();
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{t("purchaseEntry.distributor")}</label>
      <div className={styles.field}>
        <div className={styles.searchIconBox}>
          <Search size={16} color="#47745a" />
        </div>
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={t("purchaseEntry.enterDistributor")}
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
                <span className={styles.matchMeta}>{t("purchaseEntry.match")}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
