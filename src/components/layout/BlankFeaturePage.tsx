import { usePreferences } from "@/app/providers/PreferencesProvider";
import gonFreecssDecoration from "@/assets/coming-soon/gon-freecss.png";
import styles from "./BlankFeaturePage.module.css";

export function BlankFeaturePage() {
  const { t } = usePreferences();

  return (
    <section className={styles.page} aria-labelledby="blank-feature-title">
      <div className={styles.layout}>
        <div className={styles.decoration} aria-hidden="true">
          <span className={styles.decorationRing} />
          <img src={gonFreecssDecoration} alt="" draggable={false} />
        </div>

        <div className={styles.copy}>
          <span className={styles.eyebrow}>{t("placeholder.planned")}</span>
          <h1 id="blank-feature-title">{t("placeholder.title")}</h1>
        </div>
      </div>
    </section>
  );
}
