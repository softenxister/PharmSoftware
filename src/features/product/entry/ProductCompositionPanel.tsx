import type { SalesProduct } from "@server/db/types";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import styles from "./ProductEntry.module.css";

type ProductCompositionPanelProps = {
  activeIngredients?: SalesProduct["activeIngredients"];
  compositionStatus?: SalesProduct["compositionStatus"];
  genericName?: string;
  variant?: "default" | "edit";
};

export function ProductCompositionPanel({
  activeIngredients,
  compositionStatus,
  genericName,
  variant = "default",
}: ProductCompositionPanelProps) {
  const { t } = usePreferences();

  return (
    <section className={`${styles.genericNamePanel} ${
      variant === "edit" ? styles.editCompositionPanel : ""
    }`} aria-labelledby="stock-generic-name-label">
      <div className={styles.genericNameHeading}>
        <span id="stock-generic-name-label">{t("stockForm.genericName")}</span>
        <small>{t("stockForm.genericNameReadOnly")}</small>
      </div>
      {genericName && (
        <div className={styles.importedGenericName}>
          <small>{t("stockForm.importedGenericName")}</small>
          <strong>{genericName}</strong>
        </div>
      )}
      {activeIngredients?.length ? (
        <div className={styles.genericIngredientList} role="list">
          {activeIngredients.map((ingredient) => (
            <div key={ingredient.id} className={styles.genericIngredient} role="listitem">
              <span className={styles.genericIngredientNames}>
                <strong>{ingredient.canonicalName}</strong>
                {ingredient.thaiName && <small>{ingredient.thaiName}</small>}
              </span>
              {ingredient.strength && (
                <span className={styles.genericIngredientStrength}>{ingredient.strength}</span>
              )}
            </div>
          ))}
        </div>
      ) : !genericName ? (
        <p className={styles.genericNameEmpty}>
          {compositionStatus === "pending"
            ? t("stockForm.genericNamePending")
            : compositionStatus === "not_applicable"
              ? t("stockForm.genericNameNotApplicable")
              : t("stockForm.genericNameUnavailable")}
        </p>
      ) : null}
    </section>
  );
}
