import { DateField } from "@/features/purchase/components/DateField";
import { DistributorField } from "@/features/purchase/components/DistributorField";
import { selectPurchaseDiscountType, type PurchaseDiscountType } from "./purchaseDraft";
import type { PurchaseWorkflow } from "./usePurchaseWorkflow";
import styles from "../PurchaseEntry.module.css";

export function PurchaseDetailsPanel({ workflow }: { workflow: PurchaseWorkflow }) {
  const {
    t, workflowStep, isEditable, isLoadingPurchase, distributor, setDistributor,
    matches, showMatches, setShowMatches, highlightedDistributorIndex,
    setHighlightedDistributorIndex, handleDistributorKeyDown, distributorSearchRef,
    vatIncluded, setVatIncluded, purchaseDiscount, setPurchaseDiscount,
    purchaseDiscountType, setPurchaseDiscountType,
    purchaseDiscountTiming, setPurchaseDiscountTiming, billNo, setBillNo,
  } = workflow;

  const selectDiscountType = (type: PurchaseDiscountType) => {
    const selection = selectPurchaseDiscountType(purchaseDiscount, type);
    setPurchaseDiscount(selection.value);
    setPurchaseDiscountType(selection.type);
  };
  return (
    <>
          <div className={styles.workflowSteps} aria-label={t("purchaseEntry.progress")}>
            {[t("purchase.draft"), t("purchaseEntry.review"), t("purchaseEntry.completed")].map((label, index) => (
              <div
                key={label}
                className={`${styles.workflowStep} ${index <= workflowStep ? styles.workflowStepActive : ""} ${index < workflowStep ? styles.workflowStepDone : ""}`}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          <fieldset className={styles.workflowFieldset} disabled={!isEditable || isLoadingPurchase}>
          <div className={styles.formGrid}>
            <div className={styles.distributorColumn} ref={distributorSearchRef}>
              <DistributorField
                value={distributor}
                matches={matches}
                showMatches={showMatches}
                highlightedIndex={highlightedDistributorIndex}
                onChange={value => {
                  setDistributor(value);
                  setShowMatches(true);
                }}
                onFocus={() => {
                  setShowMatches(true);
                  setHighlightedDistributorIndex(0);
                }}
                onKeyDown={handleDistributorKeyDown}
                onHighlight={setHighlightedDistributorIndex}
                onSelect={value => {
                  setDistributor(value);
                  setShowMatches(false);
                }}
              />
              <label className={styles.vatOptionBox}>
                <input
                  type="checkbox"
                  checked={vatIncluded}
                  onChange={event => setVatIncluded(event.target.checked)}
                />
                <span>
                  <strong>VAT 7%</strong>
                  <small>{vatIncluded ? t("purchaseEntry.vatIncluded") : t("purchaseEntry.vatPlus")}</small>
                </span>
              </label>
              <div className={styles.discountBox}>
                <label className={styles.fieldLabel} htmlFor="purchase-discount">{t("purchaseEntry.discount")}</label>
                <div className={styles.discountControl}>
                  <input
                    id="purchase-discount"
                    type="text"
                    inputMode="decimal"
                    value={purchaseDiscount}
                    onChange={event => setPurchaseDiscount(event.target.value)}
                    aria-label={t("purchaseEntry.discount")}
                  />
                  <div className={styles.discountTypeToggle} role="group" aria-label={t("purchaseEntry.discountType")}>
                    <button
                      type="button"
                      className={purchaseDiscountType === "percent" ? styles.segmentButtonActive : styles.segmentButton}
                      aria-pressed={purchaseDiscountType === "percent"}
                      aria-label={t("purchaseEntry.percent")}
                      onClick={() => selectDiscountType("percent")}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={purchaseDiscountType === "thb" ? styles.segmentButtonActive : styles.segmentButton}
                      aria-pressed={purchaseDiscountType === "thb"}
                      aria-label={t("purchaseEntry.baht")}
                      onClick={() => selectDiscountType("thb")}
                    >
                      ฿
                    </button>
                  </div>
                  <div className={styles.discountTimingToggle} role="group" aria-label={t("purchaseEntry.discountTiming")}>
                    <button
                      type="button"
                      className={purchaseDiscountTiming === "beforeVat" ? styles.segmentButtonActive : styles.segmentButton}
                      aria-pressed={purchaseDiscountTiming === "beforeVat"}
                      onClick={() => setPurchaseDiscountTiming("beforeVat")}
                    >
                      {t("purchaseEntry.beforeVat")}
                    </button>
                    <button
                      type="button"
                      className={purchaseDiscountTiming === "afterVat" ? styles.segmentButtonActive : styles.segmentButton}
                      aria-pressed={purchaseDiscountTiming === "afterVat"}
                      onClick={() => setPurchaseDiscountTiming("afterVat")}
                    >
                      {t("purchaseEntry.afterVat")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel}>{t("purchaseEntry.billNo")}</label>
              <input
                className={styles.inputField}
                placeholder={t("purchaseEntry.optional")}
                value={billNo}
                onChange={event => setBillNo(event.target.value)}
              />
            </div>

            <DateField label={t("purchaseEntry.billDate")} />
            <DateField label={t("purchaseEntry.dueDate")} />
          </div>
          </fieldset>
    </>
  );
}
