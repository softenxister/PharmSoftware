import { CheckCircle2 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { ProductEntryForm } from "@/features/product/entry/ProductEntryForm";
import { productToStockItemInput } from "@/features/product/entry/productItemDraft";
import { StockBatchAdjustmentDialog } from "@/features/stock/StockBatchAdjustmentDialog";
import { StockItemDetailDialog } from "@/features/stock/StockItemDetailDialog";
import { StockInventoryFilters } from "./StockInventoryFilters";
import { StockInventoryTable } from "./StockInventoryTable";
import { useStockInventory } from "./useStockInventory";
import styles from "@/features/stock/Stock.module.css";

export function StockInventory() {
  const { t } = usePreferences();
  const controller = useStockInventory();
  const editingProduct = controller.productEntry.product;

  return (
    <div className={styles.page}>
      <StockInventoryFilters controller={controller} />
      <StockInventoryTable controller={controller} />

      {controller.productEntry.isOpen && (
        <div
          className={styles.stockWindowBackdrop}
          role="presentation"
          onMouseDown={controller.productEntry.close}
        >
          <section
            className={`${styles.stockEntryWindow} ${
              styles.stockEntryWindowEdit
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct
              ? t("stock.editDialog", { name: editingProduct.itemName })
              : t("stock.createDialog")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <ProductEntryForm
              key={editingProduct?.id ?? "new-item"}
              initialItem={editingProduct ? productToStockItemInput(editingProduct) : undefined}
              activeIngredients={editingProduct?.activeIngredients}
              importedIngredients={editingProduct?.importedIngredients}
              compositionStatus={editingProduct?.compositionStatus}
              mode={editingProduct ? "edit" : "create"}
              onSave={controller.productEntry.save}
              onDelete={editingProduct ? controller.productEntry.delete : undefined}
              onClose={controller.productEntry.close}
            />
          </section>
        </div>
      )}

      {controller.adjustment.product && controller.user?.role === "owner" && (
        <StockBatchAdjustmentDialog
          product={controller.adjustment.product}
          onClose={controller.adjustment.close}
          onUpdated={controller.adjustment.save}
        />
      )}
      {controller.itemDetail.product && controller.user && (
        <StockItemDetailDialog
          product={controller.itemDetail.product}
          role={controller.user.role}
          onClose={controller.itemDetail.close}
          onSaved={controller.itemDetail.save}
        />
      )}
      {controller.adjustment.success && (
        <div className={styles.adjustmentSuccessToast} role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{t("stock.adjustmentSaved")}</span>
        </div>
      )}
    </div>
  );
}
