import { Package, PackagePlus, ReceiptText, Save, X } from "lucide-react";
import {
  formatPurchaseExpiryInput as formatExpiryDateInput,
  isPurchaseExpiryDate as isValidExpiryDate,
} from "@/lib/expiryDate";
import { PurchaseUnitDropdown } from "../PurchaseUnitDropdown";
import { getPurchaseUnitDisplayValue } from "./purchaseDraft";
import type { PurchaseWorkflow } from "./usePurchaseWorkflow";
import styles from "../PurchaseEntry.module.css";

export function PurchaseLineEditor({ workflow }: { workflow: PurchaseWorkflow }) {
  const {
    t, formatMoney, selectedItem, closePurchaseLine, localizeUnit,
    qtyInputRef, lineQty, setLineQty, handlePurchaseFlowEnter,
    lineCost, setLineCost, unit, setUnit, selectedUnitOptions,
    includeFreeQty, setIncludeFreeQty, freeQty, setFreeQty,
    freeUnit, setFreeUnit, lotNo, setLotNo, expiryDate, setExpiryDate,
    vatIncluded, lineActualCost, canAddPurchaseLine, addPurchaseLine,
    editingPurchaseLineId,
  } = workflow;
  if (!selectedItem) return null;
  const hasActualCost = Number.isFinite(Number(lineQty))
    && Number(lineQty) > 0
    && lineActualCost.baseCost > 0;
  const displayUnit = (value: string) => localizeUnit(getPurchaseUnitDisplayValue(value));

  return (
    <div className={styles.purchaseWindowBackdrop} role="presentation" onMouseDown={closePurchaseLine}>
      <section
        className={styles.purchaseEntryWindow}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-line-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.purchaseWindowHeader}>
          <span className={styles.purchaseHeaderImageFrame}>
            {selectedItem.imageUrl
              ? <img src={selectedItem.imageUrl} alt="" className={styles.purchaseHeaderImage} />
              : <Package size={30} aria-hidden="true" />}
          </span>
          <span className={styles.purchaseHeaderProductInfo}>
            <h2 id="purchase-line-title">{selectedItem.itemName}</h2>
            <span className={styles.purchaseHeaderProductMeta}>
              <span>{selectedItem.manufacturerName}</span>
              <span aria-hidden="true">|</span>
              <span>{localizeUnit(selectedItem.pack.label)}</span>
            </span>
          </span>
          <button type="button" className={styles.windowCloseButton} onClick={closePurchaseLine} aria-label={t("purchaseEntry.closeLine")}>
            <X size={19} />
          </button>
        </header>

        <div className={styles.purchaseWindowBody}>
          <section className={styles.purchaseFormPanel} aria-label={t("purchaseEntry.lineDetails")}>
                    <div className={styles.purchaseFormGrid}>
                      <div className={styles.purchasePrimaryRow}>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.quantity")}</span>
                          <input
                            ref={qtyInputRef}
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={lineQty}
                            onChange={event => setLineQty(event.target.value)}
                            data-purchase-flow="qty"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.cost")}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={t("purchaseEntry.cost")}
                            value={lineCost}
                            onChange={event => setLineCost(event.target.value)}
                            data-purchase-flow="cost"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>

                        <PurchaseUnitDropdown
                          label={t("purchaseEntry.purchaseUnit")}
                          value={unit}
                          options={selectedUnitOptions}
                          getOptionLabel={displayUnit}
                          onChange={setUnit}
                        />
                      </div>

                      <fieldset className={styles.freeQtyPanel}>
                        <legend>
                          <label className={styles.freeQtyLegend}>
                            <input
                              type="checkbox"
                              checked={includeFreeQty}
                              onChange={event => setIncludeFreeQty(event.target.checked)}
                            />
                            <span>{t("purchaseEntry.freeQty")}</span>
                          </label>
                        </legend>
                        <div className={styles.freeQtyControls}>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={t("purchaseEntry.freeQty")}
                            disabled={!includeFreeQty}
                            className={styles.freeQtyInput}
                            value={freeQty}
                            onChange={event => setFreeQty(event.target.value)}
                          />
                          <PurchaseUnitDropdown
                            label={t("purchaseEntry.freeUnit")}
                            value={freeUnit}
                            options={selectedUnitOptions}
                            disabled={!includeFreeQty}
                            showLabel={false}
                            getOptionLabel={displayUnit}
                            onChange={setFreeUnit}
                          />
                        </div>
                      </fieldset>

                      <div className={styles.purchaseLotRow}>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.lotNo")}</span>
                          <input
                            type="text"
                            placeholder={t("purchaseEntry.lotNo")}
                            value={lotNo}
                            onChange={event => setLotNo(event.target.value)}
                            data-purchase-flow="lot"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.expDate")}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="DD-MM-YY"
                            value={expiryDate}
                            aria-invalid={expiryDate.length > 0 && !isValidExpiryDate(expiryDate)}
                            onChange={event => setExpiryDate(formatExpiryDateInput(event.target.value))}
                            onBlur={() => setExpiryDate(formatExpiryDateInput(expiryDate))}
                            data-purchase-flow="expiry"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>
                      </div>

                      <section className={styles.actualCostRow} aria-live="polite" aria-label={t("purchaseEntry.actualCost")}>
                        <span className={styles.actualCostIcon}><ReceiptText size={18} /></span>
                        <span className={styles.actualCostCopy}>
                          <strong>{t("purchaseEntry.actualCost")}</strong>
                          <small>
                            {hasActualCost ? (
                              <>
                                <span>{t("purchaseEntry.cost")}: ฿{formatMoney(lineActualCost.baseCost)}</span>
                                <span>{t("purchaseEntry.discount")}: −฿{formatMoney(lineActualCost.discountPerUnit)}</span>
                                <span>VAT: +฿{formatMoney(lineActualCost.vatPerUnit)}{vatIncluded ? ` (${t("purchaseEntry.vatIncluded")})` : ""}</span>
                              </>
                            ) : t("purchaseEntry.actualCostHint")}
                          </small>
                        </span>
                        <span className={styles.actualCostValue}>
                          <strong>{hasActualCost ? `฿${formatMoney(lineActualCost.actualCost)}` : "—"}</strong>
                          <small>{t("purchaseEntry.perUnit", { unit: localizeUnit(unit) })}</small>
                        </span>
                      </section>
                    </div>
          </section>
        </div>

        <footer className={styles.purchaseWindowFooter}>
          <button type="button" className={styles.secondaryWindowButton} onClick={closePurchaseLine}>
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={styles.primaryWindowButton}
            disabled={!canAddPurchaseLine}
            onClick={addPurchaseLine}
            data-purchase-flow="add"
            onKeyDown={handlePurchaseFlowEnter}
          >
            {editingPurchaseLineId ? <Save size={16} /> : <PackagePlus size={16} />}
            {editingPurchaseLineId ? t("purchaseEntry.updateLine") : t("newSale.add")}
          </button>
        </footer>
      </section>
    </div>
  );
}
