import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { ProductCompositionStatus, ProductIngredient } from "@server/db/types";
import {
  classifyStockRegulatoryForms,
  STOCK_REGULATORY_FORMS,
} from "@/lib/stockRegulatoryRecords";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

type ProductRegulatoryFieldsProps = {
  controller: ProductItemDraftController;
  variant?: "default" | "edit-row";
  activeIngredients?: ProductIngredient[];
  compositionStatus?: ProductCompositionStatus;
};

export function ProductRegulatoryFields({
  controller,
  variant = "default",
  activeIngredients,
  compositionStatus,
}: ProductRegulatoryFieldsProps) {
  const { t } = usePreferences();
  const regulatoryForms = classifyStockRegulatoryForms({
    legalCategory: controller.draft.legalCategory,
    compositionStatus,
    activeIngredients,
    dosageType: controller.draft.subUnit,
  });
  const options = STOCK_REGULATORY_FORMS.map((form) => (
    <label key={form} className={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={regulatoryForms.includes(form)}
        disabled
      />
      <span>{form}</span>
    </label>
  ));

  if (variant === "edit-row") {
    return (
      <>
        <div className={`${styles.field} ${styles.editInsetRow}`}>
          <span>{t("stockForm.legalCategory")}</span>
          <output className={styles.editReadOnlyValue}>{controller.draft.legalCategory || "—"}</output>
        </div>
        <div className={`${styles.field} ${styles.editInsetRow}`}>
          <span>{t("stockForm.record")}</span>
          <div
            className={styles.editRecordOptions}
            role="group"
            aria-label={t("stockForm.record")}
          >
            {options}
          </div>
        </div>
      </>
    );
  }

  return (
    <section className={styles.regulatoryFormsPanel} aria-label={t("stockForm.records")}>
        <div className={styles.regulatoryFormsHeader}><h2>{t("stockForm.records")}</h2></div>
        <div className={styles.packagingRegulatoryOptions}>
          {options}
        </div>
    </section>
  );
}
