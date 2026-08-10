import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

const REGULATORY_FORM_OPTIONS = ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"];

type ProductRegulatoryFieldsProps = {
  controller: ProductItemDraftController;
  variant?: "default" | "edit-row";
};

export function ProductRegulatoryFields({
  controller,
  variant = "default",
}: ProductRegulatoryFieldsProps) {
  const { t } = usePreferences();
  const options = REGULATORY_FORM_OPTIONS.map((form) => (
    <label key={form} className={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={form === "ข.ย. 9" || controller.draft.regulatoryForms.includes(form)}
        disabled={form === "ข.ย. 9"}
        onChange={() => controller.changeRegulatoryForm(form)}
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
