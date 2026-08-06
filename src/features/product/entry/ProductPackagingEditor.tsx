import { useEffect, useRef, type KeyboardEvent } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import {
  PRODUCT_PACKAGE_VALUES,
  PRODUCT_SUBUNIT_VALUES,
  localizeProductUnit,
} from "@/i18n/productUnits";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/forms/SearchableSelect";
import { decimalText } from "./productItemDraft";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

export function ProductPackagingEditor({
  controller,
  variant = "default",
}: {
  controller: ProductItemDraftController;
  variant?: "default" | "edit";
}) {
  const { t, preferences } = usePreferences();
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const options = (values: readonly string[], currentValue: string): SearchableSelectOption[] => (
    [...new Set([...values, currentValue])]
      .map((value) => ({
        value,
        label: localizeProductUnit(preferences.locale, value),
      }))
  );

  useEffect(() => {
    if (!controller.focusPackagingRowId) return;
    rowRefs.current[controller.focusPackagingRowId]
      ?.querySelector<HTMLInputElement>("input")
      ?.focus();
    controller.clearPackagingFocus();
  }, [controller]);

  const handleEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    event.preventDefault();
    controller.appendPackagingRow(true);
  };

  return (
    <section
      className={`${styles.packagingPanel} ${variant === "edit" ? styles.editPackagingPanel : ""}`}
      aria-label={t("stockForm.packaging")}
    >
      <div className={styles.packagingHeader}>
        <div><h2>{t("stockForm.packagingIn")}</h2></div>
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => controller.appendPackagingRow(true)}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{t("stockForm.addRow")}</span>
        </button>
      </div>

      <div className={styles.packagingRows}>
        {controller.draft.packagingRows.map((row) => (
          <div
            className={styles.packagingRow}
            key={row.id}
            onKeyDown={handleEnter}
            ref={(element) => {
              rowRefs.current[row.id] = element;
            }}
          >
            <label className={`${styles.field} ${variant === "edit" ? styles.editInsetRow : ""}`}>
              <span>{t("stockForm.package")}</span>
              <SearchableSelect
                compact
                ariaLabel={t("stockForm.package")}
                value={row.parentUnit}
                options={options(PRODUCT_PACKAGE_VALUES, row.parentUnit)}
                onChange={(value) => controller.patchPackagingRow(row.id, { parentUnit: value })}
              />
            </label>
            <label className={`${styles.field} ${variant === "edit" ? styles.editInsetRow : ""}`}>
              <span>{t("stockForm.subValue")}</span>
              <input
                type="text"
                inputMode="numeric"
                value={row.childQuantity}
                onChange={(event) => controller.patchPackagingRow(row.id, {
                  childQuantity: event.target.value.replace(/\D/g, ""),
                })}
              />
            </label>
            <label className={`${styles.field} ${variant === "edit" ? styles.editInsetRow : ""}`}>
              <span>{t("stockForm.subUnit")}</span>
              <SearchableSelect
                compact
                ariaLabel={t("stockForm.subUnit")}
                value={row.childUnit}
                options={options(PRODUCT_SUBUNIT_VALUES, row.childUnit)}
                onChange={(value) => controller.patchPackagingRow(row.id, { childUnit: value })}
              />
            </label>
            <label className={`${styles.field} ${variant === "edit" ? styles.editInsetRow : ""}`}>
              <span>{t("stockForm.unitSellPrice")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={row.sellPrice}
                onChange={(event) => controller.patchPackagingRow(row.id, {
                  sellPrice: decimalText(event.target.value),
                })}
              />
            </label>
            <label className={`${styles.field} ${variant === "edit" ? styles.editInsetRow : ""}`}>
              <span>{t("stockForm.barcodes")}</span>
              <span className={styles.inlineField}>
                <input
                  value={row.barcode}
                  onChange={(event) => controller.patchPackagingRow(row.id, {
                    barcode: event.target.value,
                  })}
                  placeholder={t("stockForm.barcodesPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => controller.appendGeneratedBarcode(row.id)}
                  title={t("stockForm.generateBarcode")}
                >
                  <Wand2 size={15} aria-hidden="true" />
                </button>
              </span>
            </label>
            <button
              type="button"
              className={styles.removeRowButton}
              onClick={() => controller.deletePackagingRow(row.id)}
              aria-label={t("stockForm.removePackaging")}
              title={t("stockForm.removeRow")}
              disabled={controller.draft.packagingRows.length === 1}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
