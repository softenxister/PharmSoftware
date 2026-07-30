import { ShieldAlert } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { IngredientOption } from "./memberProfileTypes";
import styles from "./MemberDetail.module.css";

export function MemberAllergyPanel({ allergies }: { allergies: IngredientOption[] }) {
  const { t } = usePreferences();

  return (
    <section className={styles.allergyPanel} aria-labelledby="member-allergies-title">
      <div className={styles.allergyPanelHeading}>
        <span className={styles.allergyPanelIcon}>
          <ShieldAlert size={17} aria-hidden="true" />
        </span>
        <div>
          <h2 id="member-allergies-title">{t("member.drugAllergies")}</h2>
          <p>{t("member.drugAllergiesHint")}</p>
        </div>
      </div>
      <div className={styles.allergyList}>
        {allergies.length > 0 ? allergies.map((ingredient) => (
          <span key={ingredient.id} className={styles.allergyTag}>
            <strong>{ingredient.canonicalName}</strong>
            {ingredient.thaiName && <small>{ingredient.thaiName}</small>}
          </span>
        )) : (
          <span className={styles.noAllergies}>{t("member.noDrugAllergies")}</span>
        )}
      </div>
    </section>
  );
}
