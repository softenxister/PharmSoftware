import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import styles from "./FormattedDateInput.module.css";

type FormattedDateInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  calendarLabel: string;
};

function formatTypedDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function displayDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

function isoDateToDisplay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";

  const [, year, month, day] = match;
  const displayValue = `${day}/${month}/${year}`;
  return displayDateToIso(displayValue) === value ? displayValue : "";
}

export function FormattedDateInput({ id, value, onChange, calendarLabel }: FormattedDateInputProps) {
  const [displayValue, setDisplayValue] = useState(() => isoDateToDisplay(value));
  const [hasBlurred, setHasBlurred] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const internalValueChangeRef = useRef(false);
  const isInvalid = hasBlurred && displayValue !== "" && displayDateToIso(displayValue) === null;

  useEffect(() => {
    if (internalValueChangeRef.current) {
      internalValueChangeRef.current = false;
      return;
    }

    setDisplayValue(isoDateToDisplay(value));
    setHasBlurred(false);
  }, [value]);

  const commitValue = (nextValue: string) => {
    if (nextValue === value) return;
    internalValueChangeRef.current = true;
    onChange(nextValue);
  };

  const openCalendar = () => {
    const picker = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker) return;

    try {
      if (picker.showPicker) {
        picker.showPicker();
        return;
      }
    } catch {
      // The click fallback below supports browsers that expose but restrict showPicker.
    }

    picker.focus();
    picker.click();
  };

  return (
    <div className={`${styles.control} ${isInvalid ? styles.controlInvalid : ""}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="DD/MM/YYYY"
        value={displayValue}
        aria-invalid={isInvalid || undefined}
        className={styles.textInput}
        onFocus={() => setHasBlurred(false)}
        onBlur={() => setHasBlurred(true)}
        onChange={(event) => {
          const nextDisplayValue = formatTypedDate(event.target.value);
          const nextIsoValue = displayDateToIso(nextDisplayValue);
          setDisplayValue(nextDisplayValue);
          setHasBlurred(false);

          commitValue(nextIsoValue ?? "");
        }}
      />
      <button type="button" className={styles.calendarButton} onClick={openCalendar} aria-label={calendarLabel}>
        <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value}
        tabIndex={-1}
        aria-label={calendarLabel}
        className={styles.nativePicker}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
