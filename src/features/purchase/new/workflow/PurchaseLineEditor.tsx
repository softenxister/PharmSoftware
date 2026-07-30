import { PackagePlus, X } from "lucide-react";
import { formatDateDisplay, formatExpiryDateInput, isValidExpiryDate } from "../../purchaseUtils";
import { PurchaseUnitDropdown } from "../PurchaseUnitDropdown";
import type { PurchaseWorkflow } from "./usePurchaseWorkflow";
import styles from "../PurchaseEntry.module.css";

export function PurchaseLineEditor({ workflow }: { workflow: PurchaseWorkflow }) {
  const { t, selectedItem, closePurchaseLine, localizeUnit, qtyInputRef, lineQty, setLineQty, handlePurchaseFlowEnter, lineCost, setLineCost, unit, setUnit, selectedUnitOptions, includeFreeQty, setIncludeFreeQty, freeQty, setFreeQty, freeUnit, setFreeUnit, lotNo, setLotNo, expiryDate, setExpiryDate, canAddPurchaseLine, addPurchaseLine } = workflow;
  if (!selectedItem) return null;
  return (
            <div className={styles.purchaseWindowBackdrop} role="presentation" onMouseDown={closePurchaseLine}>
              <section
                className={styles.purchaseEntryWindow}
                role="dialog"
                aria-modal="true"
                aria-labelledby="purchase-line-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button type="button" className={styles.windowCloseButton} onClick={closePurchaseLine} aria-label={t("purchaseEntry.closeLine")}>
                  <X size={16} />
                </button>

                <div className={styles.purchaseWindowHeader}>
                  <div>
                    <h2 id="purchase-line-title">{t("purchaseEntry.purchaseItem")}</h2>
                    <p>{t("purchaseEntry.confirmLine")}</p>
                  </div>
                </div>

                <div className={styles.purchaseWindowBody}>
                  <section className={styles.purchaseProductPanel} aria-label={t("purchaseEntry.selectedItem")}>
                    <div className={styles.purchaseProductImage}>
                      <img src={selectedItem.imageUrl} alt="" />
                    </div>
                    <div className={styles.purchaseProductMeta}>
                      <strong>{selectedItem.itemName}</strong>
                      <small>{selectedItem.brandName} - {selectedItem.manufacturerName}</small>
                      <small>{localizeUnit(selectedItem.pack.label)}</small>
                    </div>
                  </section>

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
                          getOptionLabel={localizeUnit}
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
                            getOptionLabel={localizeUnit}
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
                            onBlur={() => setExpiryDate(formatDateDisplay(expiryDate))}
                            data-purchase-flow="expiry"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>
                      </div>
                    </div>
                  </section>
                </div>

                <div className={styles.purchaseWindowFooter}>
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
                    <PackagePlus size={16} />
                    {t("newSale.add")}
                  </button>
                </div>
              </section>
            </div>
  );
}
