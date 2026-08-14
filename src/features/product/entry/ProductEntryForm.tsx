import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PackagePlus, Trash2, X } from "lucide-react";
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
import { ProductCompositionPanel } from "./ProductCompositionPanel";
import { ProductIdentityFields } from "./ProductIdentityFields";
import { ProductPackagingEditor } from "./ProductPackagingEditor";
import { ProductPhotoField } from "./ProductPhotoField";
import {
  PRODUCT_EDIT_TABS,
  getAdjacentProductEditTab,
  type ProductEditTab,
} from "./productEditTabs";
import { useProductItemDraft } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

type ProductEntryFormProps = {
  onSave?: (item: StockItemInput, photoFile?: File) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  initialItem?: StockItemInput;
  activeIngredients?: SalesProduct["activeIngredients"];
  importedIngredients?: SalesProduct["importedIngredients"];
  compositionStatus?: SalesProduct["compositionStatus"];
  mode?: "create" | "edit";
  onClose?: () => void;
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
  importedIngredients,
  compositionStatus,
  mode = "create",
  onClose,
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
  const editTabRefs = useRef<Partial<Record<ProductEditTab, HTMLButtonElement | null>>>({});
  const [activeEditTab, setActiveEditTab] = useState<ProductEditTab>("general");
  const editTabLabels: Record<ProductEditTab, string> = {
    general: t("stockForm.general"),
    "pricing-stock": t("stockForm.pricingAndStock"),
    ingredients: t("stockForm.ingredients"),
    packaging: t("stockForm.packagingTab"),
  };

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

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: ProductEditTab,
  ) => {
    let nextTab: ProductEditTab | undefined;
    if (event.key === "ArrowRight") nextTab = getAdjacentProductEditTab(tab, 1);
    if (event.key === "ArrowLeft") nextTab = getAdjacentProductEditTab(tab, -1);
    if (event.key === "Home") nextTab = PRODUCT_EDIT_TABS[0];
    if (event.key === "End") nextTab = PRODUCT_EDIT_TABS[PRODUCT_EDIT_TABS.length - 1];
    if (!nextTab) return;
    event.preventDefault();
    setActiveEditTab(nextTab);
    editTabRefs.current[nextTab]?.focus();
  };

  return (
    <form
      ref={formRef}
      className={`${styles.stockForm} ${styles.stockFormPortrait} ${styles.stockFormEdit}`}
      onSubmit={submit}
      noValidate
    >
      <header className={styles.formHeader}>
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
          {onClose && (
            <button
              type="button"
              className={styles.formCloseButton}
              disabled={controller.deleting || controller.saving}
              onClick={onClose}
              aria-label={t("stock.closeItemEditor")}
            >
              <X size={19} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {controller.deleteConfirmationOpen && <ProductDeleteDialog controller={controller} />}

      <div className={styles.stockFormContent}>
        <div className={styles.editWorkspace}>
          <ProductPhotoField
            controller={controller}
            variant="edit"
            onFlowEnter={handleFlowEnter}
            onSelectIdentity={(input) => selectProductIdentityText(mode, input)}
          />

          <div className={styles.editContentColumn}>
            <div
              className={styles.editTabBar}
              role="tablist"
              aria-label={t("stockForm.editSections")}
            >
              {PRODUCT_EDIT_TABS.map((tab) => (
                <button
                  key={tab}
                  ref={(element) => {
                    editTabRefs.current[tab] = element;
                  }}
                  id={`edit-item-tab-${tab}`}
                  type="button"
                  className={`${styles.editTabButton} ${
                    activeEditTab === tab ? styles.editTabButtonActive : ""
                  }`}
                  role="tab"
                  aria-selected={activeEditTab === tab}
                  aria-controls="edit-item-tab-panel"
                  tabIndex={activeEditTab === tab ? 0 : -1}
                  onClick={() => setActiveEditTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab)}
                >
                  {editTabLabels[tab]}
                </button>
              ))}
            </div>

            <div
              id="edit-item-tab-panel"
              className={styles.editTabViewport}
              role="tabpanel"
              aria-labelledby={`edit-item-tab-${activeEditTab}`}
            >
              {activeEditTab === "general" && (
                <ProductIdentityFields
                  controller={controller}
                  categoryOptions={categoryOptions}
                  section="general"
                  activeIngredients={activeIngredients}
                  importedIngredients={importedIngredients}
                  compositionStatus={compositionStatus}
                  onFlowEnter={handleFlowEnter}
                  onFlowCommit={focusNextField}
                  onSelectIdentity={(input) => selectProductIdentityText(mode, input)}
                />
              )}
              {activeEditTab === "pricing-stock" && (
                <ProductIdentityFields
                  controller={controller}
                  categoryOptions={categoryOptions}
                  section="pricing-stock"
                  onFlowEnter={handleFlowEnter}
                  onFlowCommit={focusNextField}
                  onSelectIdentity={(input) => selectProductIdentityText(mode, input)}
                />
              )}
              {activeEditTab === "ingredients" && (
                <ProductCompositionPanel
                  variant="edit"
                  activeIngredients={activeIngredients}
                  importedIngredients={importedIngredients}
                  compositionStatus={compositionStatus}
                  genericName={controller.draft.genericName}
                />
              )}
              {activeEditTab === "packaging" && (
                <div className={styles.editPackagingTab}>
                  <ProductPackagingEditor controller={controller} variant="edit" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formFooter}>
        {controller.saveError && (
          <p className={styles.saveErrorMessage} role="alert" title={controller.saveError}>
            {controller.saveError}
          </p>
        )}
        <div className={styles.formFooterActions}>
          {onClose && (
            <button
              type="button"
              className={styles.formCancelButton}
              disabled={controller.deleting || controller.saving}
              onClick={onClose}
            >
              {t("staff.cancel")}
            </button>
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
      </div>
    </form>
  );
}
