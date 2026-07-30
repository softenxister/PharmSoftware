import type { KeyboardEvent } from "react";
import { ImagePlus, Wand2 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

export function ProductPhotoField({
  controller,
  onSelectIdentity,
  onFlowEnter,
}: {
  controller: ProductItemDraftController;
  onSelectIdentity: (input: HTMLInputElement) => void;
  onFlowEnter: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const { t } = usePreferences();
  const { draft } = controller;

  return (
    <section className={styles.photoPanel} aria-label={t("stockForm.productPhoto")}>
      <div className={styles.photoPreview}>
        {draft.photoUrl.trim() ? (
          <img src={draft.photoUrl} alt={t("stockForm.preview")} />
        ) : (
          <span><ImagePlus size={30} aria-hidden="true" /></span>
        )}
      </div>
      <label className={styles.field}>
        <span>{t("stockForm.photo")}</span>
        <input
          type="text"
          value={draft.photoUrl}
          placeholder="https://example.com/photo.jpg"
          onClick={(event) => onSelectIdentity(event.currentTarget)}
          onChange={(event) => controller.updateField("photoUrl", event.target.value)}
        />
      </label>
      <label className={styles.field} data-stock-flow="barcode" onKeyDown={onFlowEnter}>
        <span>{t("stockForm.barcodes")}</span>
        <span className={styles.inlineField}>
          <input
            type="text"
            value={draft.barcode}
            onClick={(event) => onSelectIdentity(event.currentTarget)}
            onChange={(event) => controller.updateField("barcode", event.target.value)}
            placeholder={t("stockForm.barcodesPlaceholder")}
          />
          <button
            type="button"
            onClick={() => controller.appendGeneratedBarcode()}
            title={t("stockForm.generateBarcode")}
          >
            <Wand2 size={15} aria-hidden="true" />
          </button>
        </span>
      </label>
    </section>
  );
}
