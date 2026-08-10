import { Phone, ScanBarcode, Search } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import type { PurchaseItemSearchModel } from "./usePurchaseWorkflow";
import styles from "../PurchaseEntry.module.css";

export function PurchaseItemSearch({ model }: { model: PurchaseItemSearchModel }) {
  const {
    t,
    localizeUnit,
    isEditable,
    query,
    itemSearchLoading,
    itemDropdownOpen,
    highlightedItemIndex,
    selectedItem,
    itemMatches,
    showScanCarousel,
    fileRef,
    purchaseItemSearchRef,
    changeQuery,
    focusSearch,
    handleItemSearchKeyDown,
    highlightItem,
    openItem,
    openFirstMatch,
    openFirstBarcodeItem,
  } = model;

  if (!isEditable) return null;

  return (
    <>
      <div className={styles.scanSearchLayer} aria-label={t("purchaseEntry.scanSearch")}>
        <div className={styles.manualSearch} ref={purchaseItemSearchRef}>
          <ScanBarcode size={17} className={styles.manualSearchIcon} />
          <input
            type="text"
            aria-label={t("purchaseEntry.scanSearch")}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onFocus={focusSearch}
            onKeyDown={handleItemSearchKeyDown}
            placeholder={t("purchaseEntry.scanSearch")}
          />
          {itemDropdownOpen && query.trim().length > 0 && !selectedItem && (
            <div className={styles.itemDropdownPanel}>
              {itemMatches.length === 0 && (
                <div className={styles.dropdownEmpty}>
                  {itemSearchLoading ? "Loading…" : t("newSale.noItem")}
                </div>
              )}
              {itemMatches.map((product, index) => {
                const nearestBatch = product.batches[0];
                const stockCount = product.batches.reduce(
                  (sum, batch) => sum + batch.availableStock,
                  0,
                );
                const isHighlighted = index === highlightedItemIndex;

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`${styles.itemOption} ${isHighlighted ? styles.itemOptionActive : ""}`}
                    aria-selected={isHighlighted}
                    onMouseEnter={() => highlightItem(index)}
                    onMouseMove={() => highlightItem(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      openItem(product);
                    }}
                  >
                    <ProductImage
                      priority={index < 4}
                      src={product.imageUrl}
                      alt=""
                      width={42}
                      height={42}
                      className={styles.itemOptionThumb}
                    />
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
          onClick={openFirstMatch}
        >
          <Search size={16} />
          {t("purchaseEntry.findItem")}
        </button>
      </div>

      {showScanCarousel && (
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

              <button
                type="button"
                className={`${styles.swapPage} ${styles.scannerPage}`}
                onClick={openFirstBarcodeItem}
                aria-label={t("purchaseEntry.barcodeScanner")}
              >
                <span className={styles.scannerScene}>
                  <span className={styles.counterScanner}>
                    <span className={styles.scannerHead}>
                      <span className={styles.scannerLens} />
                    </span>
                    <span className={styles.scannerHandle}>
                      <span className={styles.scannerTrigger} />
                    </span>
                  </span>
                  <span className={styles.scannerLightPath} />
                  <span className={`${styles.productBottle} ${styles.counterBottle}`}>
                    <span className={styles.bottleCap} />
                    <span className={styles.bottleNeck} />
                    <span className={styles.bottleBody}>
                      <span className={styles.bottleLabel} />
                      <span className={styles.bottleBarcode} />
                    </span>
                    <span className={styles.scannerRedBeam} />
                  </span>
                </span>
                <span className={styles.swapCopy}>
                  <strong>{t("purchaseEntry.barcodeScanner")}</strong>
                  <span>{t("purchaseEntry.barcodeScannerHint")}</span>
                </span>
              </button>

              <button
                type="button"
                className={`${styles.swapPage} ${styles.barcodePage}`}
                onClick={openFirstBarcodeItem}
                aria-label={t("purchaseEntry.scanBarcode")}
              >
                <span className={styles.applePhone}>
                  <span className={styles.phoneSpeaker} />
                  <span className={styles.phoneScreen}>
                    <span className={styles.phoneTop}>
                      <Phone size={13} />
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
            </div>
            <div className={styles.swapDots} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
