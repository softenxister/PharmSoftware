import { ChevronRight, PackagePlus, Phone, ScanBarcode, Search } from "lucide-react";
import { PurchaseWorkflowBar } from "./PurchaseWorkflowBar";
import { PurchaseCorrectionDialog } from "./PurchaseCorrectionDialog";
import { PurchaseDetailsPanel } from "./workflow/PurchaseDetailsPanel";
import { PurchaseLineEditor } from "./workflow/PurchaseLineEditor";
import { PurchaseLineTable } from "./workflow/PurchaseLineTable";
import { usePurchaseWorkflow } from "./workflow/usePurchaseWorkflow";
import styles from "./PurchaseEntry.module.css";

export function PurchaseEntry({ purchaseId }: { purchaseId?: string }) {
  const workflow = usePurchaseWorkflow(purchaseId);
  const {
    navigate, t, localizeUnit,
    activePurchaseId, distributor, setDistributor, billNo, setBillNo,
    manualItem, setManualItem, catalog, itemSearchLoading,
    itemDropdownOpen, setItemDropdownOpen,
    highlightedItemIndex, setHighlightedItemIndex,
    selectedItem, setSelectedItem,
    purchaseLines, setPurchaseLines,
    vatIncluded, setVatIncluded,
    salesAdjustment, setSalesAdjustment,
    salesAdjustmentType, setSalesAdjustmentType,
    isSavingPurchase, purchaseSaveError, purchaseLoadError, isLoadingPurchase,
    editingBillStatus, reviewConfirmed, setReviewConfirmed, currentUser,
    correctionRequests, correctionDialogOpen, setCorrectionDialogOpen,
    correctionReason, setCorrectionReason, correctionError, setCorrectionError,
    isSubmittingCorrection,
    showMatches, setShowMatches,
    highlightedDistributorIndex, setHighlightedDistributorIndex,
    fileRef, distributorSearchRef, purchaseItemSearchRef,
    matches, itemMatches, showScanCarousel,
    totalQty, netPurchaseTotal,
    isEditable, hasValidBill, hasPendingCorrection, workflowStep,
    openPurchaseLine, savePurchase, submitCorrectionRequest,
    handleDistributorKeyDown, handleItemSearchKeyDown,
  } = workflow;

  return (
    <div className={styles.page}>
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <span>{t("nav.purchase")}</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>{activePurchaseId ? t("purchaseEntry.edit") : t("purchaseEntry.new")}</span>
        </div>
        <div className={styles.toolbarActions}>
          {(purchaseSaveError || purchaseLoadError) && (
            <span className={styles.toolbarError} role="alert">{purchaseSaveError || purchaseLoadError}</span>
          )}
          {isEditable ? (
            <button
              type="button"
              className={styles.saveButton}
              disabled={!hasValidBill || isSavingPurchase || isLoadingPurchase}
              onClick={() => void savePurchase("draft")}
            >
              <PackagePlus size={16} />
              {isSavingPurchase ? t("common.saving") : activePurchaseId ? t("purchaseEntry.saveChanges") : t("purchaseEntry.saveDraft")}
            </button>
          ) : (
            <span className={`${styles.workflowStatusBadge} ${editingBillStatus === "received" ? styles.workflowStatusCompleted : ""}`}>
              {editingBillStatus === "partial" ? t("purchaseEntry.readyReview") : t("purchaseEntry.completed")}
            </span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.detailsPanel} aria-label={t("purchaseEntry.details")}>
          <PurchaseDetailsPanel workflow={workflow} />

          {isEditable && <div className={styles.scanSearchLayer} aria-label={t("purchaseEntry.scanSearch")}>
            <div className={styles.manualSearch} ref={purchaseItemSearchRef}>
              <ScanBarcode size={17} className={styles.manualSearchIcon} />
              <input
                type="text"
                aria-label={t("purchaseEntry.scanSearch")}
                value={manualItem}
                onChange={(event) => {
                  setManualItem(event.target.value);
                  setSelectedItem(null);
                  setItemDropdownOpen(true);
                }}
                onFocus={() => {
                  setItemDropdownOpen(true);
                  setHighlightedItemIndex(0);
                }}
                onKeyDown={handleItemSearchKeyDown}
                placeholder={t("purchaseEntry.scanSearch")}
              />
              {itemDropdownOpen && manualItem.trim().length > 0 && !selectedItem && (
                <div className={styles.itemDropdownPanel}>
                  {itemMatches.length === 0 && (
                    <div className={styles.dropdownEmpty}>
                      {itemSearchLoading ? "Loading…" : t("newSale.noItem")}
                    </div>
                  )}
                  {itemMatches.map((product, index) => {
                    const nearestBatch = product.batches[0];
                    const stockCount = product.batches.reduce((sum, batch) => sum + batch.availableStock, 0);
                    const isHighlighted = index === highlightedItemIndex;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`${styles.itemOption} ${isHighlighted ? styles.itemOptionActive : ""}`}
                        aria-selected={isHighlighted}
                        onMouseEnter={() => setHighlightedItemIndex(index)}
                        onMouseMove={() => setHighlightedItemIndex(index)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          openPurchaseLine(product);
                        }}
                      >
                        <img src={product.imageUrl} alt="" className={styles.itemOptionThumb} />
                        <span className={styles.itemOptionMeta}>
                          <span className={styles.itemOptionName}>{product.itemName}</span>
                          <span className={styles.itemOptionSub}>
                            {product.brandName} - {localizeUnit(product.pack.label)} - {product.location || t("purchaseEntry.noLocation")}
                          </span>
                        </span>
                        <span className={styles.itemOptionPrice}>
                          {nearestBatch ? `฿${nearestBatch.sellPriceThb}` : t("purchaseEntry.noBatch")}
                          <small>{t("nav.stock")} {stockCount}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.addLineButton}
              disabled={itemMatches.length === 0}
              onClick={() => {
                if (itemMatches[0]) openPurchaseLine(itemMatches[0]);
              }}
            >
              <Search size={16} />
              {t("purchaseEntry.findItem")}
            </button>
          </div>}

          <PurchaseLineTable workflow={workflow} />
          {isEditable && showScanCarousel && (
            <div className={styles.scanVisualLayer} aria-label={t("purchaseEntry.importOptions")}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className={styles.hiddenFileInput}
              />
              <div className={styles.swapWindow}>
                <div className={styles.swapStage}>
                  <button
                    type="button"
                    className={`${styles.swapPage} ${styles.barcodePage}`}
                    onClick={() => {
                      const firstBarcodeItem = catalog.find(product => /^\d{13}$/.test(product.barcode));
                      if (firstBarcodeItem) openPurchaseLine(firstBarcodeItem);
                    }}
                    aria-label={t("purchaseEntry.scanBarcode")}
                  >
                    <span className={styles.applePhone}>
                      <span className={styles.phoneSpeaker} />
                      <span className={styles.phoneScreen}>
                        <span className={styles.phoneTop}>
                          <Phone size={13} color="#47745a" />
                          <span className={styles.scanLabel}>SCAN</span>
                        </span>
                        <span className={styles.barcodeBox}>
                          <span className={styles.productBottle}>
                            <span className={styles.bottleCap} />
                            <span className={styles.bottleNeck} />
                            <span className={styles.bottleBody}>
                              <span className={styles.bottleLabel} />
                              <span className={styles.bottleBarcode} />
                            </span>
                            <span className={styles.scanBeam} />
                          </span>
                        </span>
                        <span className={styles.phoneLinePrimary} />
                        <span className={styles.phoneLineSecondary} />
                      </span>
                    </span>
                    <span className={styles.swapCopy}>
                      <strong>{t("purchaseEntry.scanBarcode")}</strong>
                      <span>{t("purchaseEntry.scanHint")}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.swapPage} ${styles.csvPage}`}
                    onClick={() => fileRef.current?.click()}
                    aria-label={t("purchaseEntry.uploadCsvFile")}
                  >
                    <span className={styles.photoIconFrame}>
                      <span className={styles.csvFileArt}>
                        <span className={styles.csvFold} />
                        <span className={styles.csvBadge}>CSV</span>
                        <span className={styles.csvLine} />
                        <span className={styles.csvLine} />
                        <span className={styles.csvLineShort} />
                      </span>
                    </span>
                    <span className={styles.swapCopy}>
                      <strong>{t("purchaseEntry.uploadCsv")}</strong>
                      <span>{t("purchaseEntry.uploadHint")}</span>
                    </span>
                  </button>
                </div>
                <div className={styles.swapDots} aria-hidden="true">
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {isEditable && selectedItem && <PurchaseLineEditor workflow={workflow} />}
        </section>
      </div>

      {purchaseLines.length > 0 && (
        <PurchaseWorkflowBar
          status={editingBillStatus}
          itemCount={purchaseLines.length}
          totalQty={totalQty}
          netTotal={netPurchaseTotal}
          canContinue={hasValidBill && !isLoadingPurchase}
          isBusy={isSavingPurchase}
          reviewConfirmed={reviewConfirmed}
          canManageStock={currentUser.canManageStock}
          hasPendingCorrection={hasPendingCorrection}
          onReviewConfirmedChange={setReviewConfirmed}
          onPrepare={() => void savePurchase("partial", true)}
          onBackToEdit={() => void savePurchase("draft", true)}
          onComplete={() => void savePurchase("received", true)}
          onRequestCorrection={() => {
            setCorrectionError("");
            setCorrectionDialogOpen(true);
          }}
          onAdjustStock={() => {
            if (!activePurchaseId) return;
            const pendingRequest = correctionRequests.find(request => request.status === "pending");
            const requestQuery = pendingRequest ? `&requestId=${encodeURIComponent(pendingRequest.id)}` : "";
            navigate(`/stock/adjustment?purchaseId=${encodeURIComponent(activePurchaseId)}${requestQuery}`);
          }}
        />
      )}

      {correctionDialogOpen && (
        <PurchaseCorrectionDialog
          reason={correctionReason}
          error={correctionError}
          isSubmitting={isSubmittingCorrection}
          onReasonChange={setCorrectionReason}
          onClose={() => {
            if (!isSubmittingCorrection) setCorrectionDialogOpen(false);
          }}
          onSubmit={() => void submitCorrectionRequest()}
        />
      )}
    </div>
  );
}
