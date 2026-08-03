import { useId, useState } from "react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { FormattedDateInput } from "@/components/forms/FormattedDateInput";
import styles from "@/features/purchase/new/PurchaseEntry.module.css";

function localTodayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateField({ label }: { label: string }) {
  const { t } = usePreferences();
  const inputId = useId();
  const [date, setDate] = useState(localTodayIso);

  return (
    <div className={styles.purchaseDateField}>
      <label className={styles.fieldLabel} htmlFor={inputId}>{label}</label>
      <FormattedDateInput
        id={inputId}
        value={date}
        onChange={setDate}
        calendarLabel={t("purchaseEntry.openCalendar", { label })}
      />
    </div>
  );
}
