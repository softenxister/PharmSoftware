import { ChevronRight, PackagePlus } from "lucide-react";
import { PurchaseCorrectionDialog } from "./PurchaseCorrectionDialog";
import { PurchaseWorkflowBar } from "./PurchaseWorkflowBar";
import { PurchaseDetailsPanel } from "./workflow/PurchaseDetailsPanel";
import { PurchaseItemSearch } from "./workflow/PurchaseItemSearch";
import { PurchaseLineEditor } from "./workflow/PurchaseLineEditor";
import { PurchaseLineTable } from "./workflow/PurchaseLineTable";
import { usePurchaseWorkflow } from "./workflow/usePurchaseWorkflow";
import styles from "./PurchaseEntry.module.css";

export function PurchaseEntry({ purchaseId }: { purchaseId?: string }) {
  const workflow = usePurchaseWorkflow(purchaseId);
  const header = workflow.header;

  return (
    <div className={styles.page}>
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <span>{header.t("nav.purchase")}</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>
            {header.activePurchaseId
              ? header.t("purchaseEntry.edit")
              : header.t("purchaseEntry.new")}
          </span>
        </div>
        <div className={styles.toolbarActions}>
          {header.error && (
            <span className={styles.toolbarError} role="alert">{header.error}</span>
          )}
          {header.isEditable ? (
            <button
              type="button"
              className={styles.saveButton}
              disabled={!header.canSaveDraft || header.isSavingPurchase || header.isLoadingPurchase}
              onClick={() => void header.saveDraft()}
            >
              <PackagePlus size={16} />
              {header.isSavingPurchase
                ? header.t("common.saving")
                : header.activePurchaseId
                  ? header.t("purchaseEntry.saveChanges")
                  : header.t("purchaseEntry.saveDraft")}
            </button>
          ) : (
            <span className={`${styles.workflowStatusBadge} ${header.editingBillStatus === "received" ? styles.workflowStatusCompleted : ""}`}>
              {header.editingBillStatus === "partial"
                ? header.t("purchaseEntry.readyReview")
                : header.t("purchaseEntry.completed")}
            </span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.detailsPanel} aria-label={header.t("purchaseEntry.details")}>
          <PurchaseDetailsPanel model={workflow.details} />
          <PurchaseItemSearch model={workflow.itemSearch} />
          <PurchaseLineTable model={workflow.lines} />
          <PurchaseLineEditor model={workflow.lineEditor} />
        </section>
      </div>

      <PurchaseWorkflowBar model={workflow.workflowBar} />
      <PurchaseCorrectionDialog model={workflow.correctionDialog} />
    </div>
  );
}
