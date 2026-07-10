"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  PackagePlus,
  Phone,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import styles from "./PurchaseEntry.module.css";
import { getDistributorMatches } from "../purchaseUtils";
import { DateField } from "@/features/events/components/purchase/DateField";
import { DistributorField } from "@/features/events/components/purchase/DistributorField";
import type { SalesProduct } from "@/server/db/types";
import { invalidateStockCatalog, loadStockCatalog } from "@/app/stock/stockCatalogClient";

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type PurchaseLine = {
  id: string;
  productId: string;
  barcode: string;
  imageUrl: string;
  itemName: string;
  unit: string;
  unitMultiplier: number;
  qty: string;
  cost: string;
  freeQty: string;
  freeUnit: string;
  freeUnitMultiplier: number;
  lotNo: string;
  expiryDate: string;
};

function matchesItemQuery(product: SalesProduct, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return false;

  if (/^\d{5,}$/.test(query)) return product.barcode.includes(query);

  return (
    product.itemName.toLowerCase().includes(query) ||
    product.brandName.toLowerCase().includes(query) ||
    product.manufacturerName.toLowerCase().includes(query) ||
    product.category.toLowerCase().includes(query) ||
    product.pack.label.toLowerCase().includes(query) ||
    product.pack.packUnit.toLowerCase().includes(query) ||
    product.parentPacks.some(pack => pack.packUnit.toLowerCase().includes(query))
  );
}

export function PurchaseEntry() {
  const router = useRouter();
  const [distributor, setDistributor] = useState("");
  const [distributorOptions, setDistributorOptions] = useState<string[]>([]);
  const [billNo, setBillNo] = useState("");
  const [manualItem, setManualItem] = useState("");
  const [catalog, setCatalog] = useState<SalesProduct[]>([]);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SalesProduct | null>(null);
  const [includeFreeQty, setIncludeFreeQty] = useState(false);
  const [unit, setUnit] = useState("Blister");
  const [freeUnit, setFreeUnit] = useState("Blister");
  const [lineQty, setLineQty] = useState("");
  const [lineCost, setLineCost] = useState("");
  const [freeQty, setFreeQty] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [vatIncluded, setVatIncluded] = useState(true);
  const [salesAdjustment, setSalesAdjustment] = useState("0");
  const [salesAdjustmentType, setSalesAdjustmentType] = useState<"percent" | "thb">("percent");
  const [purchaseConfirmOpen, setPurchaseConfirmOpen] = useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [purchaseSaveError, setPurchaseSaveError] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [highlightedDistributorIndex, setHighlightedDistributorIndex] = useState(0);
  const [hasUpload, setHasUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const distributorSearchRef = useRef<HTMLDivElement>(null);
  const purchaseItemSearchRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => getDistributorMatches(distributorOptions, distributor),
    [distributor, distributorOptions],
  );

  useEffect(() => {
    setHighlightedDistributorIndex(0);
  }, [distributor]);

  useEffect(() => {
    setHighlightedDistributorIndex((current) => {
      if (matches.length === 0) return 0;
      return Math.min(current, matches.length - 1);
    });
  }, [matches.length]);

  const itemMatches = useMemo(
    () => catalog.filter(product => matchesItemQuery(product, manualItem)).slice(0, 8),
    [catalog, manualItem],
  );

  useEffect(() => {
    setHighlightedItemIndex(0);
  }, [manualItem]);

  useEffect(() => {
    setHighlightedItemIndex((current) => {
      if (itemMatches.length === 0) return 0;
      return Math.min(current, itemMatches.length - 1);
    });
  }, [itemMatches.length]);
  const hasLineDraft = selectedItem !== null;
  const showScanCarousel = manualItem.trim().length === 0 && !hasLineDraft && purchaseLines.length === 0;
  const selectedUnitOptions = useMemo(() => {
    if (!selectedItem) return [];
    return [selectedItem.pack.packUnit, ...selectedItem.parentPacks.map(pack => pack.packUnit)]
      .filter((option, index, options) => option && options.indexOf(option) === index);
  }, [selectedItem]);
  const canAddPurchaseLine = Boolean(
    selectedItem &&
    Number(lineQty) > 0 &&
    Number(lineCost) > 0 &&
    Number.isFinite(Number(lineQty)) &&
    Number.isFinite(Number(lineCost)),
  );
  const totalQty = useMemo(
    () => purchaseLines.reduce((sum, line) => sum + parsePositiveNumber(line.qty), 0),
    [purchaseLines],
  );
  const subtotal = useMemo(
    () => purchaseLines.reduce((sum, line) => sum + parsePositiveNumber(line.qty) * parsePositiveNumber(line.cost), 0),
    [purchaseLines],
  );
  const salesAdjustmentValue = parsePositiveNumber(salesAdjustment);
  const salesAdjustmentAmount = salesAdjustmentType === "percent"
    ? (subtotal * Math.min(salesAdjustmentValue, 99)) / 100
    : salesAdjustmentValue;
  const vatAmount = vatIncluded ? 0 : subtotal * 0.07;
  const netPurchaseTotal = Math.max(subtotal + vatAmount + salesAdjustmentAmount, 0);
  const marginPercent = subtotal > 0 ? (salesAdjustmentAmount / subtotal) * 100 : 0;

  const getUnitMultiplier = (product: SalesProduct, packUnit: string) => {
    if (product.pack.packUnit === packUnit) return 1;
    return product.parentPacks.find(pack => pack.packUnit === packUnit)?.priceMultiplier ?? 1;
  };

  useEffect(() => {
    function closeDropdownsOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (distributorSearchRef.current && !distributorSearchRef.current.contains(target)) {
        setShowMatches(false);
      }
      if (purchaseItemSearchRef.current && !purchaseItemSearchRef.current.contains(target)) {
        setItemDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDropdownsOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeDropdownsOnOutsideClick);
  }, []);

  const openPurchaseLine = useCallback((product: SalesProduct) => {
    const defaultUnit = product.pack.packUnit || "Blister";
    const firstBatch = product.batches[0];
    setSelectedItem(product);
    setManualItem(product.barcode);
    setItemDropdownOpen(false);
    setUnit(defaultUnit);
    setFreeUnit(defaultUnit);
    setIncludeFreeQty(false);
    setLineQty("");
    setLineCost(firstBatch?.sellPriceThb ? String(firstBatch.sellPriceThb) : "");
    setFreeQty("");
    setLotNo(firstBatch?.batchNo ?? "");
    setExpiryDate(firstBatch?.expiryDate ?? "");
  }, []);

  function handleItemSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!itemDropdownOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setItemDropdownOpen(true);
    }

    if (event.key === "ArrowDown" && itemMatches.length > 0) {
      event.preventDefault();
      setHighlightedItemIndex((current) => (current + 1) % itemMatches.length);
      return;
    }

    if (event.key === "ArrowUp" && itemMatches.length > 0) {
      event.preventDefault();
      setHighlightedItemIndex((current) => (current - 1 + itemMatches.length) % itemMatches.length);
      return;
    }

    if (event.key === "Enter") {
      const highlightedItem = itemMatches[highlightedItemIndex] ?? itemMatches[0];
      if (highlightedItem) {
        event.preventDefault();
        openPurchaseLine(highlightedItem);
      }
      return;
    }

    if (event.key === "Escape") {
      setItemDropdownOpen(false);
    }
  }

  function handleDistributorKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!showMatches && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setShowMatches(true);
    }

    if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      setHighlightedDistributorIndex((current) => (current + 1) % matches.length);
      return;
    }

    if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setHighlightedDistributorIndex((current) => (current - 1 + matches.length) % matches.length);
      return;
    }

    if (event.key === "Enter") {
      const highlightedDistributor = matches[highlightedDistributorIndex] ?? matches[0];
      if (highlightedDistributor) {
        event.preventDefault();
        setDistributor(highlightedDistributor);
        setShowMatches(false);
      }
      return;
    }

    if (event.key === "Escape") {
      setShowMatches(false);
    }
  }

  const closePurchaseLine = () => {
    setSelectedItem(null);
    setManualItem("");
    setFreeUnit("Blister");
    setIncludeFreeQty(false);
    setLineQty("");
    setLineCost("");
    setFreeQty("");
    setLotNo("");
    setExpiryDate("");
  };

  const addPurchaseLine = () => {
    if (!selectedItem || !canAddPurchaseLine) return;

    setPurchaseLines(lines => [
      ...lines,
      {
        id: `${selectedItem.id}-${Date.now()}`,
        productId: selectedItem.id,
        barcode: selectedItem.barcode,
        imageUrl: selectedItem.imageUrl,
        itemName: selectedItem.itemName,
        unit,
        unitMultiplier: getUnitMultiplier(selectedItem, unit),
        qty: lineQty.trim(),
        cost: lineCost.trim(),
        freeQty: includeFreeQty ? freeQty.trim() : "",
        freeUnit,
        freeUnitMultiplier: getUnitMultiplier(selectedItem, freeUnit),
        lotNo: lotNo.trim(),
        expiryDate: expiryDate.trim(),
      },
    ]);
    closePurchaseLine();
  };

  const focusNextPurchaseField = (currentElement: HTMLElement) => {
    const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-purchase-flow]"))
      .filter(element => !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true");
    const currentIndex = fields.indexOf(currentElement);
    const nextField = fields[currentIndex + 1];
    if (!nextField) return;
    nextField.focus();
    if (nextField instanceof HTMLInputElement) nextField.select();
  };

  const handlePurchaseFlowEnter = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof HTMLButtonElement) target.click();
    if (target instanceof HTMLInputElement && target.type === "checkbox") target.click();
    window.setTimeout(() => focusNextPurchaseField(target), 0);
  };

  const confirmPurchase = async () => {
    if (isSavingPurchase || purchaseLines.length === 0 || netPurchaseTotal <= 0) return;

    setIsSavingPurchase(true);
    setPurchaseSaveError("");

    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: billNo.trim(),
          distributor: distributor.trim(),
          totalQty,
          netTotal: netPurchaseTotal,
          lines: purchaseLines.map(line => ({
            id: line.id,
            productId: line.productId,
            barcode: line.barcode,
            itemName: line.itemName,
            unit: line.unit,
            unitMultiplier: line.unitMultiplier,
            quantity: parsePositiveNumber(line.qty),
            cost: parsePositiveNumber(line.cost),
            freeUnit: line.freeUnit,
            freeUnitMultiplier: line.freeUnitMultiplier,
            freeQuantity: parsePositiveNumber(line.freeQty),
            batchNo: line.lotNo,
            expiryDate: line.expiryDate,
          })),
        }),
      });

      if (!response.ok) throw new Error("Unable to save purchase.");
      invalidateStockCatalog();
      router.push("/purchase");
    } catch (error) {
      console.error(error);
      setPurchaseSaveError("Purchase was not saved. Please try again.");
    } finally {
      setIsSavingPurchase(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const products = await loadStockCatalog();
        if (!cancelled) setCatalog(products);
      } catch (error) {
        console.error(error);
      }
    }

    async function loadDistributors() {
      try {
        const response = await fetch("/api/distributors", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load distributors.");
        const distributorData = await response.json() as { distributors?: string[] };
        if (!cancelled && Array.isArray(distributorData.distributors)) {
          setDistributorOptions(distributorData.distributors);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadCatalog();
    void loadDistributors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedItem) return;
    const barcode = manualItem.trim();
    if (!/^\d{13}$/.test(barcode)) return;

    const exactMatch = catalog.find(product => product.barcode === barcode);
    if (exactMatch) openPurchaseLine(exactMatch);
  }, [catalog, manualItem, openPurchaseLine, selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }, [selectedItem]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbarRow}>
        <div className={styles.breadcrumb}>
          <span>Purchase</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>New purchase</span>
        </div>
        <button type="button" className={styles.saveButton} disabled={!hasUpload && !hasLineDraft && purchaseLines.length === 0}>
          <PackagePlus size={16} />
          Save purchase
        </button>
      </div>

      <div className={styles.content}>
        <section className={styles.detailsPanel} aria-label="Purchase bill details">
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
                  <small>{vatIncluded ? "Included in bill" : "Plus 7% final bill"}</small>
                </span>
              </label>
              <div className={styles.salesAdjustBox}>
                <label className={styles.fieldLabel} htmlFor="purchase-sales-adjustment">Sales</label>
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
                    aria-label="Sales adjustment"
                  />
                  <div className={styles.salesTypeToggle} aria-label="Sales adjustment type">
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
              <label className={styles.fieldLabel}>Bill No.</label>
              <input
                className={styles.inputField}
                placeholder="Optional"
                value={billNo}
                onChange={event => setBillNo(event.target.value)}
              />
            </div>

            <DateField label="Bill Date" />
            <DateField label="Due Date" />
          </div>

          <div className={styles.scanSearchLayer} aria-label="Scan barcode or search item">
            <div className={styles.manualSearch} ref={purchaseItemSearchRef}>
              <ScanBarcode size={17} className={styles.manualSearchIcon} />
              <input
                type="text"
                aria-label="Scan barcode or search item"
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
                placeholder="Scan barcode or search item"
              />
              {itemDropdownOpen && manualItem.trim().length > 0 && !selectedItem && (
                <div className={styles.itemDropdownPanel}>
                  {itemMatches.length === 0 && <div className={styles.dropdownEmpty}>No matching item.</div>}
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
                            {product.brandName} - {product.pack.label} - {product.location || "No location"}
                          </span>
                        </span>
                        <span className={styles.itemOptionPrice}>
                          {nearestBatch ? `฿${nearestBatch.sellPriceThb}` : "No batch"}
                          <small>Stock {stockCount}</small>
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
              Find item
            </button>
          </div>

          {purchaseLines.length > 0 && (
            <div className={styles.purchaseLineTableWrap}>
              <table className={styles.purchaseLineTable} aria-label="Purchase item lines">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Free qty</th>
                    <th>Lot No.</th>
                    <th>Exp. Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseLines.map(line => (
                    <tr key={line.id}>
                      <td>
                        <div className={styles.purchaseLineItem}>
                          <img src={line.imageUrl} alt="" />
                          <span>{line.itemName}</span>
                        </div>
                      </td>
                      <td>{line.qty} {line.unit}</td>
                      <td>฿{line.cost}</td>
                      <td>{line.freeQty ? `${line.freeQty} ${line.freeUnit}` : "-"}</td>
                      <td>{line.lotNo || "-"}</td>
                      <td>{line.expiryDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showScanCarousel && (
            <div className={styles.scanVisualLayer} aria-label="Purchase import options">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className={styles.hiddenFileInput}
                onChange={() => setHasUpload(true)}
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
                    aria-label="Scan barcode"
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
                      <strong>Scan barcode</strong>
                      <span>Phone scan adds purchase item lines quickly.</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.swapPage} ${styles.csvPage}`}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload CSV file"
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
                      <strong>Upload CSV</strong>
                      <span>Import distributor bill rows from file.</span>
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

          {selectedItem && (
            <div className={styles.purchaseWindowBackdrop} role="presentation" onMouseDown={closePurchaseLine}>
              <section
                className={styles.purchaseEntryWindow}
                role="dialog"
                aria-modal="true"
                aria-labelledby="purchase-line-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button type="button" className={styles.windowCloseButton} onClick={closePurchaseLine} aria-label="Close purchase line">
                  <X size={16} />
                </button>

                <div className={styles.purchaseWindowHeader}>
                  <div>
                    <h2 id="purchase-line-title">Purchase Item</h2>
                    <p>Confirm quantity, cost, unit, lot, and expiry before adding to this bill.</p>
                  </div>
                </div>

                <div className={styles.purchaseWindowBody}>
                  <section className={styles.purchaseProductPanel} aria-label="Selected item">
                    <div className={styles.purchaseProductImage}>
                      <img src={selectedItem.imageUrl} alt="" />
                    </div>
                    <div className={styles.purchaseProductMeta}>
                      <strong>{selectedItem.itemName}</strong>
                      <small>{selectedItem.brandName} - {selectedItem.manufacturerName}</small>
                      <small>{selectedItem.pack.label}</small>
                    </div>
                  </section>

                  <section className={styles.purchaseFormPanel} aria-label="Purchase line details">
                    <div className={styles.purchaseFormGrid}>
                      <div className={styles.purchasePrimaryRow}>
                        <label className={styles.compactField}>
                          <span>Quantity</span>
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
                          <span>Cost</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Cost"
                            value={lineCost}
                            onChange={event => setLineCost(event.target.value)}
                            data-purchase-flow="cost"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>

                        <fieldset className={styles.unitField} aria-label="Purchase unit">
                          <div className={styles.unitOptions} aria-label="Purchase unit options">
                            {selectedUnitOptions.map(option => (
                              <button
                                key={option}
                                type="button"
                                className={unit === option ? styles.unitOptionActive : styles.unitOption}
                                onClick={() => setUnit(option)}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </div>

                      <fieldset className={styles.freeQtyPanel}>
                        <legend>
                          <label className={styles.freeQtyLegend}>
                            <input
                              type="checkbox"
                              checked={includeFreeQty}
                              onChange={event => setIncludeFreeQty(event.target.checked)}
                            />
                            <span>Free quantity</span>
                          </label>
                        </legend>
                        <div className={styles.freeQtyControls}>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Free qty"
                            disabled={!includeFreeQty}
                            className={styles.freeQtyInput}
                            value={freeQty}
                            onChange={event => setFreeQty(event.target.value)}
                          />
                          <div className={styles.unitOptions}>
                            {selectedUnitOptions.map(option => (
                              <button
                                key={option}
                                type="button"
                                className={freeUnit === option ? styles.unitOptionActive : styles.unitOption}
                                onClick={() => setFreeUnit(option)}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </fieldset>

                      <div className={styles.purchaseLotRow}>
                        <label className={styles.compactField}>
                          <span>Lot No.</span>
                          <input
                            type="text"
                            placeholder="Lot"
                            value={lotNo}
                            onChange={event => setLotNo(event.target.value)}
                            data-purchase-flow="lot"
                            onKeyDown={handlePurchaseFlowEnter}
                          />
                        </label>
                        <label className={styles.compactField}>
                          <span>Exp. Date</span>
                          <input
                            type="text"
                            placeholder="dd/mm/yyyy"
                            value={expiryDate}
                            onChange={event => setExpiryDate(event.target.value)}
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
                    Cancel
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
                    Add
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>

      {purchaseLines.length > 0 && (
        <div className={styles.purchaseSummaryBar} aria-label="Purchase bill summary">
          <div className={styles.purchaseSummaryStat}>
            <span className={styles.purchaseSummaryLabel}>Margin %</span>
            <span className={styles.purchaseSummaryValue}>{marginPercent.toFixed(1)}%</span>
          </div>
          <div className={styles.purchaseSummaryDivider} />
          <div className={styles.purchaseSummaryStat}>
            <span className={styles.purchaseSummaryLabel}>Qty</span>
            <span className={styles.purchaseSummaryValue}>{totalQty}</span>
          </div>
          <div className={styles.purchaseSummaryDivider} />
          <div className={styles.purchaseSummaryStat}>
            <span className={styles.purchaseSummaryLabel}>Item</span>
            <span className={styles.purchaseSummaryValue}>{purchaseLines.length}</span>
          </div>
          <button
            type="button"
            className={styles.purchaseNetButton}
            onClick={() => setPurchaseConfirmOpen(true)}
            disabled={netPurchaseTotal <= 0}
          >
            <span className={styles.purchaseSummaryLabel}>Net payment</span>
            <span className={styles.purchaseNetValue}>฿{formatMoney(netPurchaseTotal)}</span>
          </button>
        </div>
      )}

      {purchaseConfirmOpen && (
        <div className={styles.purchaseConfirmBackdrop} role="presentation" onMouseDown={() => setPurchaseConfirmOpen(false)}>
          <section
            className={styles.purchaseConfirmWindow}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="purchase-confirm-title">Confirm purchase</h2>
            <p>
              Make sure you already purchased these items from {distributor.trim() || "this distributor"} before finishing this bill.
            </p>
            <div className={styles.purchaseConfirmSummary}>
              <span>{purchaseLines.length} item</span>
              <strong>฿{formatMoney(netPurchaseTotal)}</strong>
            </div>
            {purchaseSaveError && <p className={styles.purchaseConfirmError}>{purchaseSaveError}</p>}
            <div className={styles.purchaseConfirmActions}>
              <button
                type="button"
                className={styles.secondaryWindowButton}
                onClick={() => setPurchaseConfirmOpen(false)}
                disabled={isSavingPurchase}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryWindowButton}
                onClick={confirmPurchase}
                disabled={isSavingPurchase}
              >
                {isSavingPurchase ? "Saving..." : "OK"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
