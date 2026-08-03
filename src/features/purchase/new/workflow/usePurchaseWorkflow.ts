import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SalesProduct } from "@server/db/types";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { localizeUnitExpression } from "@/i18n/productUnits";
import { invalidateStockCatalog, loadStockProductsByIds, searchStockCatalog } from "@/api/stockCatalogClient";
import {
  formatPurchaseExpiryDate as formatDateDisplay,
  formatPurchaseExpiryInput as formatExpiryDateInput,
  isPurchaseExpiryDate as isValidExpiryDate,
} from "@/lib/expiryDate";
import {
  calculatePurchaseLineActualCost, calculatePurchaseTotals, canSavePurchase, getDistributorMatches,
  getPurchaseItemSearchPriority, mergePurchaseCatalog, purchaseUnitMultiplier,
} from "./purchaseDraft";
import type {
  CurrentPharmUser, EditablePurchaseBill, PurchaseCorrection, PurchaseDiscountTiming,
  PurchaseDiscountType, PurchaseLine,
} from "./purchaseDraft";
import { persistPurchaseWorkflow, requestPurchaseCorrection } from "./purchasePersistence";

export function usePurchaseWorkflow(purchaseId?: string) {
  const navigate = useNavigate();
  const { t, preferences, formatMoney } = usePreferences();
  const localizeUnit = useCallback(
    (value: string) => localizeUnitExpression(preferences.locale, value),
    [preferences.locale],
  );
  const [activePurchaseId, setActivePurchaseId] = useState(purchaseId);
  const [distributor, setDistributor] = useState("");
  const [distributorOptions, setDistributorOptions] = useState<string[]>([]);
  const [billNo, setBillNo] = useState("");
  const [manualItem, setManualItem] = useState("");
  const [catalog, setCatalog] = useState<SalesProduct[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
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
  const [purchaseDiscount, setPurchaseDiscount] = useState("0");
  const [purchaseDiscountType, setPurchaseDiscountType] = useState<PurchaseDiscountType>("percent");
  const [purchaseDiscountTiming, setPurchaseDiscountTiming] = useState<PurchaseDiscountTiming>("beforeVat");
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [purchaseSaveError, setPurchaseSaveError] = useState("");
  const [purchaseLoadError, setPurchaseLoadError] = useState("");
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(Boolean(purchaseId));
  const [editingBillStatus, setEditingBillStatus] = useState<EditablePurchaseBill["status"] | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentPharmUser>({
    name: "Pharmacy staff",
    role: "pharmacist",
    canManageStock: false,
  });
  const [correctionRequests, setCorrectionRequests] = useState<PurchaseCorrection[]>([]);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [highlightedDistributorIndex, setHighlightedDistributorIndex] = useState(0);
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

  const itemMatches = useMemo(() => {
    const query = manualItem.trim();
    if (!query) return [];

    return catalog
      .map(product => ({ product, priority: getPurchaseItemSearchPriority(product, query) }))
      .filter((result): result is { product: SalesProduct; priority: number } => result.priority !== null)
      .sort((a, b) => a.priority - b.priority || a.product.itemName.localeCompare(b.product.itemName))
      .slice(0, 8)
      .map(({ product }) => product);
  }, [catalog, manualItem]);

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
    return [
      `${selectedItem.pack.packUnit}[1]`,
      ...selectedItem.parentPacks.map((pack) => `${pack.packUnit}[${pack.childPackQuantity}]`),
    ];
  }, [selectedItem]);
  const canAddPurchaseLine = Boolean(
    selectedItem &&
    unit &&
    Number(lineQty) > 0 &&
    Number(lineCost) > 0 &&
    Number.isFinite(Number(lineQty)) &&
    Number.isFinite(Number(lineCost)) &&
    isValidExpiryDate(expiryDate),
  );
  const {
    totalQty,
    subtotal,
    discountAmount: purchaseDiscountAmount,
    vatAmount,
    netTotal: netPurchaseTotal,
  } = useMemo(
    () => calculatePurchaseTotals(
      purchaseLines,
      vatIncluded,
      purchaseDiscount,
      purchaseDiscountType,
      purchaseDiscountTiming,
    ),
    [purchaseDiscount, purchaseDiscountTiming, purchaseDiscountType, purchaseLines, vatIncluded],
  );
  const isEditable = editingBillStatus === null || editingBillStatus === "draft";
  const hasValidBill = canSavePurchase(purchaseLines.length, netPurchaseTotal);
  const hasPendingCorrection = correctionRequests.some(request => request.status === "pending");
  const workflowStep = editingBillStatus === "received" ? 2 : editingBillStatus === "partial" ? 1 : 0;
  const lineActualCost = useMemo(
    () => calculatePurchaseLineActualCost(
      purchaseLines,
      { qty: lineQty, cost: lineCost },
      vatIncluded,
      purchaseDiscount,
      purchaseDiscountType,
      purchaseDiscountTiming,
    ),
    [
      lineCost, lineQty, purchaseDiscount, purchaseDiscountTiming,
      purchaseDiscountType, purchaseLines, vatIncluded,
    ],
  );

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

  const openPurchaseLine = useCallback((product: SalesProduct, matchedBarcode?: string) => {
    const matchedPack = matchedBarcode
      ? product.parentPacks.find((pack) => (pack.barcodes ?? []).includes(matchedBarcode))
      : undefined;
    const defaultUnit = matchedPack
      ? `${matchedPack.packUnit}[${matchedPack.childPackQuantity}]`
      : `${product.pack.packUnit || "Blister"}[1]`;
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
    setLotNo("");
    setExpiryDate("");
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
        unitMultiplier: purchaseUnitMultiplier(selectedItem, unit),
        qty: lineQty.trim(),
        cost: lineCost.trim(),
        freeQty: includeFreeQty ? freeQty.trim() : "",
        freeUnit,
        freeUnitMultiplier: purchaseUnitMultiplier(selectedItem, freeUnit),
        lotNo: lotNo.trim(),
        expiryDate: formatDateDisplay(expiryDate.trim()),
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

  const savePurchase = async (status: "draft" | "partial" | "received", stayOnPage = false) => {
    if (isSavingPurchase || !hasValidBill) return;

    setIsSavingPurchase(true);
    setPurchaseSaveError("");

    try {
      const bill = await persistPurchaseWorkflow({
        id: activePurchaseId,
        status,
        invoiceNo: billNo,
        distributor,
        totalQty,
        netTotal: netPurchaseTotal,
        lines: purchaseLines,
      });
      const wasNewPurchase = !activePurchaseId;
      setActivePurchaseId(bill.id);
      if (status === "received") invalidateStockCatalog();
      setEditingBillStatus(status);
      setReviewConfirmed(false);
      if (status === "partial" && wasNewPurchase) {
        navigate(`/purchase/new?id=${encodeURIComponent(bill.id)}`, { replace: true });
      } else if (!stayOnPage) {
        navigate("/purchase");
      }
    } catch (error) {
      console.error(error);
      setPurchaseSaveError(error instanceof Error ? error.message : "Purchase was not saved. Please try again.");
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const submitCorrectionRequest = async () => {
    if (!activePurchaseId || correctionReason.trim().length < 8 || isSubmittingCorrection) return;
    setIsSubmittingCorrection(true);
    setCorrectionError("");
    try {
      const correction = await requestPurchaseCorrection(activePurchaseId, correctionReason);
      setCorrectionRequests(requests => [correction, ...requests]);
      setCorrectionDialogOpen(false);
      setCorrectionReason("");
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Correction request could not be sent.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  useEffect(() => {
    setActivePurchaseId(purchaseId);
  }, [purchaseId]);

  useEffect(() => {
    let cancelled = false;


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

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/current-user", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load current user.");
        const data = await response.json() as { user?: CurrentPharmUser };
        if (!cancelled && data.user) setCurrentUser(data.user);
      } catch (error) {
        console.error(error);
      }
    }

    void loadDistributors();
    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activePurchaseId) return;
    let cancelled = false;

    async function loadPurchaseBill() {
      setIsLoadingPurchase(true);
      setPurchaseLoadError("");
      try {
        const response = await fetch(`/api/purchase?id=${encodeURIComponent(activePurchaseId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load this purchase bill.");
        const data = await response.json() as { bill?: EditablePurchaseBill };
        if (!data.bill) throw new Error("Purchase bill was not found.");
        const billProducts = await loadStockProductsByIds(data.bill.lines.map((line) => line.productId));
        if (cancelled) return;
        const billProductById = new Map(billProducts.map((product) => [product.id, product]));
        setCatalog((currentCatalog) => mergePurchaseCatalog(currentCatalog, billProducts));

        setBillNo(data.bill.invoiceNo === "Manual" ? "" : data.bill.invoiceNo);
        setDistributor(data.bill.distributor === "Unknown distributor" ? "" : data.bill.distributor);
        setEditingBillStatus(data.bill.status);
        setPurchaseLines(data.bill.lines.map(line => ({
          id: line.id,
          productId: line.productId,
          barcode: line.barcode,
          imageUrl: billProductById.get(line.productId)?.imageUrl ?? "",
          itemName: line.itemName,
          unit: line.unit,
          unitMultiplier: line.unitMultiplier,
          qty: String(line.quantity),
          cost: String(line.cost),
          freeQty: line.freeQuantity > 0 ? String(line.freeQuantity) : "",
          freeUnit: line.freeUnit,
          freeUnitMultiplier: line.freeUnitMultiplier,
          lotNo: line.batchNo ?? "",
          expiryDate: formatDateDisplay(line.expiryDate),
        })));
      } catch (error) {
        console.error(error);
        if (!cancelled) setPurchaseLoadError(error instanceof Error ? error.message : "Unable to load this purchase bill.");
      } finally {
        if (!cancelled) setIsLoadingPurchase(false);
      }
    }

    void loadPurchaseBill();
    return () => {
      cancelled = true;
    };
  }, [activePurchaseId]);

  useEffect(() => {
    if (!activePurchaseId || editingBillStatus !== "received") {
      setCorrectionRequests([]);
      return;
    }
    let cancelled = false;

    async function loadCorrectionRequests() {
      try {
        const response = await fetch(
          `/api/purchase-corrections?purchaseBillId=${encodeURIComponent(activePurchaseId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Unable to load correction requests.");
        const data = await response.json() as { requests?: PurchaseCorrection[] };
        if (!cancelled && Array.isArray(data.requests)) setCorrectionRequests(data.requests);
      } catch (error) {
        console.error(error);
      }
    }

    void loadCorrectionRequests();
    return () => {
      cancelled = true;
    };
  }, [activePurchaseId, editingBillStatus]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setItemSearchLoading(true);
      try {
        const products = await searchStockCatalog(manualItem);
        if (!cancelled) setCatalog((currentCatalog) => mergePurchaseCatalog(currentCatalog, products));
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setItemSearchLoading(false);
      }
    }, manualItem.trim() ? 150 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [manualItem]);

  useEffect(() => {
    if (selectedItem) return;
    const barcode = manualItem.trim();
    if (!/^\d{5,18}$/.test(barcode)) return;

    const exactMatch = catalog.find((product) => [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ].includes(barcode));
    if (exactMatch) openPurchaseLine(exactMatch, barcode);
  }, [catalog, manualItem, openPurchaseLine, selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    window.setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 0);
  }, [selectedItem]);

  return {
    navigate, t, localizeUnit, formatMoney,
    activePurchaseId, distributor, setDistributor, billNo, setBillNo,
    manualItem, setManualItem, catalog, itemSearchLoading,
    itemDropdownOpen, setItemDropdownOpen,
    highlightedItemIndex, setHighlightedItemIndex,
    selectedItem, setSelectedItem,
    includeFreeQty, setIncludeFreeQty,
    unit, setUnit, freeUnit, setFreeUnit,
    lineQty, setLineQty, lineCost, setLineCost,
    freeQty, setFreeQty, lotNo, setLotNo, expiryDate, setExpiryDate,
    purchaseLines, setPurchaseLines,
    vatIncluded, setVatIncluded,
    purchaseDiscount, setPurchaseDiscount,
    purchaseDiscountType, setPurchaseDiscountType,
    purchaseDiscountTiming, setPurchaseDiscountTiming,
    isSavingPurchase, purchaseSaveError, purchaseLoadError, isLoadingPurchase,
    editingBillStatus, reviewConfirmed, setReviewConfirmed, currentUser,
    correctionRequests, correctionDialogOpen, setCorrectionDialogOpen,
    correctionReason, setCorrectionReason, correctionError, setCorrectionError,
    isSubmittingCorrection,
    showMatches, setShowMatches,
    highlightedDistributorIndex, setHighlightedDistributorIndex,
    fileRef, qtyInputRef, distributorSearchRef, purchaseItemSearchRef,
    matches, itemMatches, showScanCarousel, selectedUnitOptions,
    canAddPurchaseLine,
    totalQty, subtotal, purchaseDiscountAmount, vatAmount, netPurchaseTotal, lineActualCost,
    isEditable, hasValidBill, hasPendingCorrection, workflowStep,
    openPurchaseLine, closePurchaseLine, addPurchaseLine,
    handlePurchaseFlowEnter, handleDistributorKeyDown, handleItemSearchKeyDown,
    savePurchase, submitCorrectionRequest,
  };
}

export type PurchaseWorkflow = ReturnType<typeof usePurchaseWorkflow>;
