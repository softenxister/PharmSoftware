import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

export function ProductDeleteDialog({
  controller,
}: {
  controller: ProductItemDraftController;
}) {
  const { t } = usePreferences();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !controller.deleting) controller.closeDeleteConfirmation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [controller]);

  return (
    <div
      className={styles.deleteConfirmOverlay}
      role="presentation"
      onMouseDown={controller.closeDeleteConfirmation}
    >
      <section
        className={styles.deleteConfirmDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-stock-item-title"
        aria-describedby="delete-stock-item-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={styles.deleteConfirmIcon} aria-hidden="true">
          <Trash2 size={22} />
        </span>
        <h2 id="delete-stock-item-title">{t("stockForm.deleteQuestion")}</h2>
        <p id="delete-stock-item-description">
          {t("stockForm.deleteDescription", {
            name: controller.draft.itemName.trim() || t("stockForm.thisItem"),
          })}
        </p>
        {controller.deleteError && (
          <div className={styles.deleteErrorMessage} role="alert">
            {controller.deleteError}
          </div>
        )}
        <div className={styles.deleteConfirmActions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.deleteCancelButton}
            onClick={controller.closeDeleteConfirmation}
            disabled={controller.deleting}
          >
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={styles.deleteConfirmButton}
            onClick={() => void controller.confirmDelete()}
            disabled={controller.deleting}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>
              {controller.deleting ? t("stockForm.deleting") : t("stockForm.delete")}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
