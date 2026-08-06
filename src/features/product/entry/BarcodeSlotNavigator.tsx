import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { PRODUCT_BARCODE_SLOT_LIMIT } from "./productItemDraft";
import styles from "./ProductEntry.module.css";

export function BarcodeSlotNavigator({
  currentIndex,
  onChange,
}: {
  currentIndex: number;
  onChange: (index: number) => void;
}) {
  const { t } = usePreferences();
  const safeIndex = Math.max(0, Math.min(currentIndex, PRODUCT_BARCODE_SLOT_LIMIT - 1));

  return (
    <span
      className={styles.barcodeSlotNavigator}
      aria-label={t("stockForm.barcodeSlot", {
        current: safeIndex + 1,
        total: PRODUCT_BARCODE_SLOT_LIMIT,
      })}
    >
      <button
        type="button"
        disabled={safeIndex === 0}
        onClick={() => onChange(safeIndex - 1)}
        aria-label={t("stockForm.previousBarcode")}
      >
        <ChevronLeft size={16} strokeWidth={3} aria-hidden="true" />
      </button>
      <span aria-live="polite">{safeIndex + 1}</span>
      <button
        type="button"
        disabled={safeIndex === PRODUCT_BARCODE_SLOT_LIMIT - 1}
        onClick={() => onChange(safeIndex + 1)}
        aria-label={t("stockForm.nextBarcode")}
      >
        <ChevronRight size={16} strokeWidth={3} aria-hidden="true" />
      </button>
    </span>
  );
}
