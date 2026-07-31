import { useEffect, useState } from 'react';
import styles from '../NewSale.module.css';
import type { SelectOption } from './saleTypes';
import { useClickOutside } from './useClickOutside';

export function CustomSelect({
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selected?.value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex);
  }, [open, selectedIndex]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`${styles.customSelect} ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        className={styles.customSelectButton}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (options.length === 0) return;
            if (!open) return void setOpen(true);
            setHighlightedIndex((current) => (current + 1) % options.length);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (options.length === 0) return;
            if (!open) return void setOpen(true);
            setHighlightedIndex((current) => (current - 1 + options.length) % options.length);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (options.length === 0) return;
            if (!open) return void setOpen(true);
            const highlightedOption = options[highlightedIndex] ?? selected;
            if (highlightedOption) choose(highlightedOption.value);
            return;
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span className={styles.customSelectValue}>
          {selected?.shortcut && <kbd className={styles.customSelectShortcut}>{selected.shortcut}</kbd>}
          <span>{selected?.label ?? ''}</span>
        </span>
        <IconChevronDown className={open ? styles.chevronOpen : ''} />
      </button>
      {open && (
        <div className={styles.customSelectMenu} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${styles.customSelectOption} ${index === highlightedIndex ? styles.customSelectOptionActive : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseMove={() => setHighlightedIndex(index)}
              onClick={() => choose(option.value)}
            >
              {option.shortcut && <kbd className={styles.customSelectShortcut}>{option.shortcut}</kbd>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const IconBin = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" className={className} aria-hidden="true">
    <path d="M4 6.5h12M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 5v1.5M6 6.5l.6 9a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-9"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconChevronDown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden="true">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPill = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 22 22" width="16" height="16" className={className} aria-hidden="true">
    <g transform="rotate(-35 11 11)">
      <rect x="3.5" y="7" width="15" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 7v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </g>
  </svg>
);

export const IconSearch = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M20 20l-4.2-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconClose = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="13" height="13" className={className} aria-hidden="true">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconTick = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" className={className} aria-hidden="true">
    <path d="M5 12.4l4.2 4.1L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPrint = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" className={className} aria-hidden="true">
    <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 12h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
