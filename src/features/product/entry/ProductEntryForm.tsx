import { useEffect, useMemo, useRef, type FormEvent, type KeyboardEvent } from "react";
import { PackagePlus, Trash2 } from "lucide-react";
import type { SalesProduct, StockItemInput } from "@server/db/types";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  canonicalizeStockCategory,
  getStockCategoryOptions,
} from "@/features/stock/stockCategoryFilter";
import {
  isProductSaveShortcut,
  selectProductIdentityText,
} from "./productItemDraft";
import { ProductDeleteDialog } from "./ProductDeleteDialog";
import { ProductIdentityFields } from "./ProductIdentityFields";
import { ProductPackagingEditor } from "./ProductPackagingEditor";
import { ProductPhotoField } from "./ProductPhotoField";
import { ProductRegulatoryFields } from "./ProductRegulatoryFields";
import { useProductItemDraft } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

type ProductEntryFormProps = {
  onSave?: (item: StockItemInput) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  initialItem?: StockItemInput;
  activeIngredients?: SalesProduct["activeIngredients"];
  compositionStatus?: SalesProduct["compositionStatus"];
  mode?: "create" | "edit";
};

function focusNextField(currentFlow: string) {
  const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-stock-flow]"));
  const currentIndex = fields.findIndex(({ dataset }) => dataset.stockFlow === currentFlow);
  const nextField = fields[currentIndex + 1];
  if (!nextField) return;
  const focusTarget = nextField.matches("input,button")
    ? nextField
    : nextField.querySelector<HTMLElement>("input,button");
  focusTarget?.focus();
}

export function ProductEntryForm({
  onSave,
  onDelete,
  initialItem,
  activeIngredients,
  compositionStatus,
  mode = "create",
}: ProductEntryFormProps) {
  const { t, preferences } = usePreferences();
  const categoryOptions = useMemo(
    () => getStockCategoryOptions(preferences.locale),
    [preferences.locale],
  );
  const controller = useProductItemDraft({
    defaultCategory: canonicalizeStockCategory(
      initialItem?.itemCategory ?? categoryOptions[0]?.value ?? "",
    ),
    initialItem,
    mode,
    onSave,
    onDelete,
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!controller.isEditing) return;
    const saveFromShortcut = (event: globalThis.KeyboardEvent) => {
      if (!isProductSaveShortcut(mode, event)) return;
      event.preventDefault();
      if (!controller.deleteConfirmationOpen) formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", saveFromShortcut);
    return () => window.removeEventListener("keydown", saveFromShortcut);
  }, [controller.deleteConfirmationOpen, controller.isEditing, mode]);

  const handleFlowEnter = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    const flow = event.currentTarget.dataset.stockFlow;
    if (!flow) return;
    event.preventDefault();
    focusNextField(flow);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void controller.save();
  };

  return (
    <form
      ref={formRef}
      className={`${styles.stockForm} ${styles.stockFormPortrait} ${
        !controller.isEditing ? styles.stockFormCreate : ""
      }`}
      onSubmit={submit}
      noValidate
    >
      <div className={styles.formHeader}>
        <div><h1>{controller.isEditing ? t("stockForm.edit") : t("stock.createItem")}</h1></div>
        <div className={styles.formHeaderActions}>
          {controller.isEditing && (
            <button
              type="button"
              className={styles.deleteItemButton}
              disabled={controller.saving}
              onClick={controller.openDeleteConfirmation}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>{t("stockForm.delete")}</span>
            </button>
          )}
        </div>
      </div>

      {controller.deleteConfirmationOpen && <ProductDeleteDialog controller={controller} />}

      <div className={styles.stockFormContent}>
        <div className={styles.formBody}>
          <ProductPhotoField
            controller={controller}
            onFlowEnter={handleFlowEnter}
            onSelectIdentity={(input) => selectProductIdentityText(mode, input)}
          />
          <ProductIdentityFields
            controller={controller}
            categoryOptions={categoryOptions}
            activeIngredients={activeIngredients}
            compositionStatus={compositionStatus}
            onFlowEnter={handleFlowEnter}
            onFlowCommit={focusNextField}
            onSelectIdentity={(input) => selectProductIdentityText(mode, input)}
          />
        </div>

        <div className={styles.stockFormLowerGrid}>
          <ProductPackagingEditor controller={controller} />
          <ProductRegulatoryFields controller={controller} />
        </div>
      </div>

      <div className={styles.formFooter}>
        {controller.saveError && (
          <p className={styles.saveErrorMessage} role="alert" title={controller.saveError}>
            {controller.saveError}
          </p>
        )}
        <button
          type="submit"
          className={`${styles.toolbarAddButton} ${
            !controller.isEditing ? styles.createActionButton : ""
          }`}
          disabled={!controller.canSave || controller.deleting || controller.saving}
        >
          <PackagePlus size={17} aria-hidden="true" />
          <span>
            {controller.saving
              ? t("stockForm.saving")
              : controller.isEditing ? t("stockForm.saveChanges") : t("stockForm.create")}
          </span>
        </button>
      </div>
    </form>
  );
}
