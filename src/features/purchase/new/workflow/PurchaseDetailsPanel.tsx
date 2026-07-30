import { DateField } from "@/features/purchase/components/DateField";
import { DistributorField } from "@/features/purchase/components/DistributorField";
import type { PurchaseWorkflow } from "./usePurchaseWorkflow";
import styles from "../PurchaseEntry.module.css";

export function PurchaseDetailsPanel({ workflow }: { workflow: PurchaseWorkflow }) {
  const {
    t, workflowStep, isEditable, isLoadingPurchase, distributor, setDistributor,
    matches, showMatches, setShowMatches, highlightedDistributorIndex,
    setHighlightedDistributorIndex, handleDistributorKeyDown, distributorSearchRef,
    vatIncluded, setVatIncluded, salesAdjustment, setSalesAdjustment,
    salesAdjustmentType, setSalesAdjustmentType, billNo, setBillNo,
  } = workflow;
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
              <div className={styles.salesAdjustBox}>
                <label className={styles.fieldLabel} htmlFor="purchase-sales-adjustment">{t("nav.sales")}</label>
                <div className={styles.salesAdjustControl}>
                  <input
                    id="purchase-sales-adjustment"
                    type="text"
                    inputMode="decimal"
                    value={salesAdjustment}
                    onChange={event => {
                      const nextValue = event.target.value;
                      setSalesAdjustment(salesAdjustmentType === "percent" ? nextValue.slice(0, 2) : nextValue);
                    }}
                    maxLength={salesAdjustmentType === "percent" ? 2 : undefined}
                    aria-label={t("purchaseEntry.salesAdjustment")}
                  />
                  <div className={styles.salesTypeToggle} aria-label={t("purchaseEntry.adjustmentType")}>
                    <button
                      type="button"
                      className={salesAdjustmentType === "percent" ? styles.salesTypeActive : styles.salesTypeButton}
                      onClick={() => {
                        setSalesAdjustmentType("percent");
                        setSalesAdjustment(value => value.slice(0, 2));
                      }}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={salesAdjustmentType === "thb" ? styles.salesTypeActive : styles.salesTypeButton}
                      onClick={() => setSalesAdjustmentType("thb")}
                    >
                      ฿
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
