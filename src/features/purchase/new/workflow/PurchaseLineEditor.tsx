import { History, Package, PackagePlus, Pencil, ReceiptText, Save, X } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { formatPurchaseExpiryDate } from "@/lib/expiryDate";
import { PurchaseUnitDropdown } from "../PurchaseUnitDropdown";
import { purchaseLineUnitDisplayValue } from "./purchaseLineEditing";
import type { PurchaseLineEditorModel } from "./usePurchaseLineEditor";
import styles from "../PurchaseEntry.module.css";

function formatHistoryDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function PurchaseLineEditor({ model }: { model: PurchaseLineEditorModel }) {
  const {
    t, formatMoney, locale, isOpen, selectedItem, localizeUnit, draft,
    unitOptions, actualCost: lineActualCost, canCommit, expiryValid,
    editingLineId, history, vatIncluded, refs, actions,
  } = model;
  if (!isOpen || !selectedItem) return null;
  const hasActualCost = Number.isFinite(Number(draft.quantity))
    && Number(draft.quantity) > 0
    && lineActualCost.baseCost > 0;
  const displayUnit = (value: string) => localizeUnit(purchaseLineUnitDisplayValue(value));
  const latestLine = history.kind === "loaded" ? history.line : null;
  const historyActualCost = history.kind === "loaded" ? history.actualCost : 0;
  const isHistoryLoading = history.kind === "loading";
  const historyError = history.kind === "failed" ? history.message : "";
  const formatHistoryQuantity = (value: number) => new Intl.NumberFormat(
    locale === "th" ? "th-TH" : "en-US",
    { maximumFractionDigits: 3 },
  ).format(value);

  return (
    <div className={styles.purchaseWindowBackdrop} role="presentation" onMouseDown={actions.close}>
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
              ? (
                <ProductImage
                  priority
                  src={selectedItem.imageUrl}
                  alt=""
                  width={60}
                  height={60}
                  className={styles.purchaseHeaderImage}
                />
              )
              : <Package size={30} aria-hidden="true" />}
          </span>
          <span className={styles.purchaseHeaderProductInfo}>
            <h2 id="purchase-line-title">
              <button
                type="button"
                className={styles.purchaseHeaderItemLink}
                aria-label={t("stock.editItemFor", { name: selectedItem.itemName })}
                onClick={actions.openStockItem}
              >
                {selectedItem.itemName}
              </button>
            </h2>
            <span className={styles.purchaseHeaderProductMeta}>
              <span>{selectedItem.manufacturerName}</span>
              <span aria-hidden="true">|</span>
              <span>{localizeUnit(selectedItem.pack.label)}</span>
            </span>
          </span>
          <button type="button" className={styles.purchaseHeaderEditButton} onClick={actions.openStockItem}>
            <Pencil size={15} aria-hidden="true" />
            <span>{t("stock.editItem")}</span>
          </button>
          <button type="button" className={styles.windowCloseButton} onClick={actions.close} aria-label={t("purchaseEntry.closeLine")}>
            <X size={19} />
          </button>
        </header>

        <div className={styles.purchaseWindowBody}>
          <div className={styles.purchaseComparisonGrid}>
            <section className={styles.purchaseFormPanel} aria-label={t("purchaseEntry.lineDetails")}>
              <header className={styles.purchaseComparisonHeader}>
                <strong>{t("purchaseEntry.currentPurchase")}</strong>
                <small>{t("purchaseEntry.confirmLine")}</small>
              </header>
              <div className={styles.purchaseFormGrid}>
                      <div className={styles.purchasePrimaryRow}>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.quantity")}</span>
                          <input
                            ref={refs.quantityInput}
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={draft.quantity}
                            onChange={event => actions.change({ quantity: event.target.value })}
                            data-purchase-flow="qty"
                            onKeyDown={actions.handleEnter}
                          />
                        </label>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.cost")}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={t("purchaseEntry.cost")}
                            value={draft.cost}
                            onChange={event => actions.change({ cost: event.target.value })}
                            data-purchase-flow="cost"
                            onKeyDown={actions.handleEnter}
                          />
                        </label>

                        <PurchaseUnitDropdown
                          label={t("purchaseEntry.purchaseUnit")}
                          value={draft.unit}
                          options={unitOptions}
                          getOptionLabel={displayUnit}
                          onChange={(unit) => actions.change({ unit })}
                        />
                      </div>

                      <fieldset
                        className={`${styles.freeQtyPanel} ${draft.includeFreeQuantity ? styles.freeQtyPanelEnabled : ""}`}
                        tabIndex={0}
                        aria-label={t("purchaseEntry.freeQty")}
                        aria-expanded={draft.includeFreeQuantity}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("input, button")) return;
                          actions.toggleFreeQuantity(!draft.includeFreeQuantity);
                        }}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          actions.toggleFreeQuantity(!draft.includeFreeQuantity);
                        }}
                      >
                        <legend className={styles.freeQtyLegend}>{t("purchaseEntry.freeQty")}</legend>
                        <div className={styles.freeQtyControls}>
                          <input
                            ref={refs.freeQuantityInput}
                            type="text"
                            inputMode="numeric"
                            placeholder={t("purchaseEntry.freeQty")}
                            disabled={!draft.includeFreeQuantity}
                            className={styles.freeQtyInput}
                            value={draft.freeQuantity}
                            onChange={event => actions.change({ freeQuantity: event.target.value })}
                            data-purchase-flow="free-qty"
                            onKeyDown={actions.handleEnter}
                          />
                          <PurchaseUnitDropdown
                            label={t("purchaseEntry.freeUnit")}
                            value={draft.freeUnit}
                            options={unitOptions}
                            disabled={!draft.includeFreeQuantity}
                            showLabel={false}
                            getOptionLabel={displayUnit}
                            onChange={(freeUnit) => actions.change({ freeUnit })}
                          />
                        </div>
                      </fieldset>

                      <div className={styles.purchaseLotRow}>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.lotNo")}</span>
                          <input
                            type="text"
                          placeholder={t("purchaseEntry.lotNo")}
                          value={draft.lotNumber}
                          onChange={event => actions.change({ lotNumber: event.target.value })}
                            data-purchase-flow="lot"
                            onKeyDown={actions.handleEnter}
                          />
                        </label>
                        <label className={styles.compactField}>
                          <span>{t("purchaseEntry.expDate")}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="DD-MM-YY"
                            value={draft.expiryDate}
                            aria-invalid={draft.expiryDate.length > 0 && !expiryValid}
                            onChange={event => actions.change({ expiryDate: event.target.value })}
                            onBlur={() => actions.change({ expiryDate: draft.expiryDate })}
                            data-purchase-flow="expiry"
                            onKeyDown={actions.handleEnter}
                          />
                        </label>
                      </div>

                      <section className={styles.actualCostRow} aria-live="polite" aria-label={t("purchaseEntry.actualCost")}>
                        <span className={styles.actualCostIcon}><ReceiptText size={18} /></span>
                        <span className={styles.actualCostCopy}>
                          <strong>{t("purchaseEntry.actualCost")}</strong>
                          {hasActualCost && (
                            <small>
                              <span>{t("purchaseEntry.cost")}: ฿{formatMoney(lineActualCost.baseCost)}</span>
                              <span>{t("purchaseEntry.discount")}: −฿{formatMoney(lineActualCost.discountPerUnit)}</span>
                              <span>VAT: +฿{formatMoney(lineActualCost.vatPerUnit)}{vatIncluded ? ` (${t("purchaseEntry.vatIncluded")})` : ""}</span>
                            </small>
                          )}
                        </span>
                        <span className={styles.actualCostValue}>
                          <strong>{hasActualCost ? `฿${formatMoney(lineActualCost.actualCost)}` : "—"}</strong>
                          <small>{t("purchaseEntry.perUnit", { unit: localizeUnit(draft.unit) })}</small>
                        </span>
                      </section>
              </div>
            </section>

            <section
              className={`${styles.purchaseFormPanel} ${styles.purchaseHistoryPanel}`}
              aria-label={t("purchaseEntry.latestPreviousPurchase")}
            >
              <header className={styles.purchaseComparisonHeader}>
                <strong><History size={15} aria-hidden="true" />{t("purchaseEntry.latestPreviousPurchase")}</strong>
                {latestLine && (
                  <small>
                    {latestLine.billNo} · {formatHistoryDate(latestLine.date, locale)} · {latestLine.distributor}
                  </small>
                )}
              </header>

              {isHistoryLoading ? (
                <div className={styles.purchaseHistoryStatus}>{t("purchaseEntry.loadingPurchaseHistory")}</div>
              ) : historyError ? (
                <div className={`${styles.purchaseHistoryStatus} ${styles.purchaseHistoryError}`}>
                  {t("purchaseEntry.purchaseHistoryError")}
                </div>
              ) : latestLine ? (
                <div className={styles.purchaseFormGrid}>
                  <div className={styles.purchasePrimaryRow}>
                    <div className={styles.compactField}>
                      <span>{t("purchaseEntry.quantity")}</span>
                      <output className={styles.purchaseHistoryValue}>
                        {formatHistoryQuantity(latestLine.quantity)}
                      </output>
                    </div>
                    <div className={styles.compactField}>
                      <span>{t("purchaseEntry.cost")}</span>
                      <output className={styles.purchaseHistoryValue}>฿{formatMoney(latestLine.cost)}</output>
                    </div>
                    <div className={styles.unitDropdownField}>
                      <span className={styles.unitDropdownLabel}>{t("purchaseEntry.purchaseUnit")}</span>
                      <output className={styles.purchaseHistoryValue}>{displayUnit(latestLine.unit)}</output>
                    </div>
                  </div>

                  <fieldset className={styles.freeQtyPanel}>
                    <legend className={styles.freeQtyLegend}>{t("purchaseEntry.freeQty")}</legend>
                    <div className={styles.freeQtyControls}>
                      <output className={styles.purchaseHistoryValue}>
                        {formatHistoryQuantity(latestLine.freeQuantity)}
                      </output>
                      <output className={styles.purchaseHistoryValue}>{displayUnit(latestLine.freeUnit)}</output>
                    </div>
                  </fieldset>

                  <div className={styles.purchaseLotRow}>
                    <div className={styles.compactField}>
                      <span>{t("purchaseEntry.lotNo")}</span>
                      <output className={styles.purchaseHistoryValue}>
                        {latestLine.batchNo || t("purchaseEntry.noBatch")}
                      </output>
                    </div>
                    <div className={styles.compactField}>
                      <span>{t("purchaseEntry.expDate")}</span>
                      <output className={styles.purchaseHistoryValue}>
                        {formatPurchaseExpiryDate(latestLine.expiryDate)}
                      </output>
                    </div>
                  </div>

                  <section className={styles.actualCostRow} aria-label={t("purchaseEntry.actualCost")}>
                    <span className={styles.actualCostIcon}><ReceiptText size={18} /></span>
                    <span className={styles.actualCostCopy}>
                      <strong>{t("purchaseEntry.actualCost")}</strong>
                      <small>
                        <span>{t("purchaseEntry.cost")}: ฿{formatMoney(latestLine.cost)}</span>
                        <span>{t("purchaseEntry.freeQty")}: {formatHistoryQuantity(latestLine.freeQuantity)}</span>
                      </small>
                    </span>
                    <span className={styles.actualCostValue}>
                      <strong>฿{formatMoney(historyActualCost)}</strong>
                      <small>{t("purchaseEntry.perUnit", { unit: displayUnit(latestLine.unit) })}</small>
                    </span>
                  </section>
                </div>
              ) : (
                <div className={styles.purchaseHistoryStatus}>
                  <strong>{t("purchaseEntry.noPurchaseHistory")}</strong>
                  <small>{t("purchaseEntry.noPurchaseHistoryHint")}</small>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className={styles.purchaseWindowFooter}>
          <button type="button" className={styles.secondaryWindowButton} onClick={actions.close}>
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={styles.primaryWindowButton}
            disabled={!canCommit}
            onClick={actions.commit}
            data-purchase-flow="add"
            onKeyDown={actions.handleEnter}
          >
            {editingLineId ? <Save size={16} /> : <PackagePlus size={16} />}
            {editingLineId ? t("purchaseEntry.updateLine") : t("newSale.add")}
          </button>
        </footer>
      </section>
    </div>
  );
}
