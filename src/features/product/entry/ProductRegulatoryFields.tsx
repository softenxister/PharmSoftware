import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

const REGULATORY_FORM_OPTIONS = ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"];

type ProductRegulatoryFieldsProps = {
  controller: ProductItemDraftController;
  variant?: "default" | "edit";
};

export function ProductRegulatoryFields({
  controller,
  variant = "default",
}: ProductRegulatoryFieldsProps) {
  const { t } = usePreferences();

  return (
    <section className={`${styles.regulatoryFormsPanel} ${
      variant === "edit" ? styles.editRegulatoryPanel : ""
    }`} aria-label={t("stockForm.records")}>
        <div className={styles.regulatoryFormsHeader}><h2>{t("stockForm.records")}</h2></div>
        <div className={styles.packagingRegulatoryOptions}>
          {REGULATORY_FORM_OPTIONS.map((form) => (
            <label key={form} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form === "ข.ย. 9" || controller.draft.regulatoryForms.includes(form)}
                disabled={form === "ข.ย. 9"}
                onChange={() => controller.changeRegulatoryForm(form)}
              />
              <span>{form}</span>
            </label>
          ))}
        </div>
    </section>
  );
}
