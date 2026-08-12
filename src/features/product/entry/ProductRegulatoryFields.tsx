import { usePreferences } from "@/app/providers/PreferencesProvider";
import type {
  ImportedProductIngredient,
  ProductCompositionStatus,
  ProductIngredient,
} from "@server/db/types";
import { STOCK_REGULATORY_FORMS } from "@/lib/stockRegulatoryRecords";
import { classifyProductRegulatoryForms } from "./productRegulatoryClassification";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

type ProductRegulatoryFieldsProps = {
  controller: ProductItemDraftController;
  variant?: "default" | "edit-row";
  activeIngredients?: ProductIngredient[];
  importedIngredients?: ImportedProductIngredient[];
  compositionStatus?: ProductCompositionStatus;
};

export function ProductRegulatoryFields({
  controller,
  variant = "default",
  activeIngredients,
  importedIngredients,
  compositionStatus,
}: ProductRegulatoryFieldsProps) {
  const { t } = usePreferences();
  const regulatoryForms = classifyProductRegulatoryForms({
    variant,
    unit: controller.draft.unit,
    subUnit: controller.draft.subUnit,
    legalCategory: controller.draft.legalCategory,
    compositionStatus,
    activeIngredients,
    importedIngredients,
    genericName: controller.draft.genericName,
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
