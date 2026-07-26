import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { localizeUnitExpression } from "@/i18n/productUnits";
import {
  ChevronRight,
  PackagePlus,
  Phone,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import styles from "./PurchaseEntry.module.css";
import {
  canSavePurchase,
  formatDateDisplay,
  formatExpiryDateInput,
  getDistributorMatches,
  isValidExpiryDate,
  toDatabaseExpiryDate,
} from "../purchaseUtils";
import { DateField } from "@/features/purchase/components/DateField";
import { DistributorField } from "@/features/purchase/components/DistributorField";
import type { SalesProduct } from "@server/db/types";
import { invalidateStockCatalog, loadStockProductsByIds, searchStockCatalog } from "@/api/stockCatalogClient";
import { PurchaseUnitDropdown } from "./PurchaseUnitDropdown";
import { PurchaseWorkflowBar } from "./PurchaseWorkflowBar";
import { PurchaseCorrectionDialog } from "./PurchaseCorrectionDialog";

const IconBin = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      d="M4 6.5h12M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 5v1.5M6 6.5l.6 9a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

type EditablePurchaseBill = {
  id: string;
  invoiceNo: string;
  distributor: string;
  status: "received" | "draft" | "partial";
  lines: Array<{
    id: string;
    productId: string;
    barcode: string;
    itemName: string;
    unit: string;
    unitMultiplier: number;
    quantity: number;
    cost: number;
    freeUnit: string;
    freeUnitMultiplier: number;
    freeQuantity: number;
    batchNo: string | null;
    expiryDate: string;
  }>;
};

type CurrentPharmUser = {
  name: string;
  role: "owner" | "pharmacist";
  canManageStock: boolean;
};

type PurchaseCorrection = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
};

function getItemSearchPriority(product: SalesProduct, rawQuery: string): number | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;

  if (/^\d{5,}$/.test(query)) {
    const barcodes = [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ];
    return barcodes.some((barcode) => barcode.includes(query)) ? 0 : null;
  }

  const itemName = product.itemName.toLowerCase();
  const brand = product.brandName.toLowerCase();
  const manufacturer = product.manufacturerName.toLowerCase();
  if (itemName.startsWith(query)) return 1;
  if (itemName.includes(query)) return 2;
  if (brand.startsWith(query)) return 3;
  if (brand.includes(query)) return 4;
  if (manufacturer.startsWith(query)) return 5;
  if (manufacturer.includes(query)) return 6;
  return null;
}

function mergeCatalogProducts(current: SalesProduct[], incoming: SalesProduct[]): SalesProduct[] {
  const incomingIds = new Set(incoming.map((product) => product.id));
  return [...incoming, ...current.filter((product) => !incomingIds.has(product.id))].slice(0, 200);
}

export function PurchaseEntry({ purchaseId }: { purchaseId?: string }) {
  const navigate = useNavigate();
  const { t, preferences } = usePreferences();
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
  const [salesAdjustment, setSalesAdjustment] = useState("0");
  const [salesAdjustmentType, setSalesAdjustmentType] = useState<"percent" | "thb">("percent");
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
      .map(product => ({ product, priority: getItemSearchPriority(product, query) }))
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
  const isEditable = editingBillStatus === null || editingBillStatus === "draft";
  const hasValidBill = canSavePurchase(purchaseLines.length, netPurchaseTotal);
  const hasPendingCorrection = correctionRequests.some(request => request.status === "pending");
  const workflowStep = editingBillStatus === "received" ? 2 : editingBillStatus === "partial" ? 1 : 0;

  const getUnitMultiplier = (product: SalesProduct, packUnit: string) => {
    if (packUnit === product.pack.packUnit || packUnit === `${product.pack.packUnit}[1]`) return 1;
    return product.parentPacks.find((pack) => (
      `${pack.packUnit}[${pack.childPackQuantity}]` === packUnit
    ))?.childPackQuantity ?? 1;
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
        unitMultiplier: getUnitMultiplier(selectedItem, unit),
        qty: lineQty.trim(),
        cost: lineCost.trim(),
        freeQty: includeFreeQty ? freeQty.trim() : "",
        freeUnit,
        freeUnitMultiplier: getUnitMultiplier(selectedItem, freeUnit),
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
      const response = await fetch("/api/purchase", {
        method: activePurchaseId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activePurchaseId,
          status,
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
            batchNo: line.lotNo.trim() || null,
            expiryDate: toDatabaseExpiryDate(line.expiryDate),
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Unable to save purchase.");
      }
      const data = await response.json() as { bill?: EditablePurchaseBill };
      if (!data.bill) throw new Error("Purchase bill was saved but could not be reloaded.");
      const wasNewPurchase = !activePurchaseId;
      setActivePurchaseId(data.bill.id);
      if (status === "received") invalidateStockCatalog();
      setEditingBillStatus(status);
      setReviewConfirmed(false);
      if (status === "partial" && wasNewPurchase) {
        navigate(`/purchase/new?id=${encodeURIComponent(data.bill.id)}`, { replace: true });
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
      const response = await fetch("/api/purchase-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseBillId: activePurchaseId, reason: correctionReason.trim() }),
      });
      const data = await response.json() as { correctionRequest?: PurchaseCorrection; error?: string };
      if (!response.ok || !data.correctionRequest) throw new Error(data.error || "Correction request could not be sent.");
      setCorrectionRequests(requests => [data.correctionRequest!, ...requests]);
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
        setCatalog((currentCatalog) => mergeCatalogProducts(currentCatalog, billProducts));

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
        if (!cancelled) setCatalog((currentCatalog) => mergeCatalogProducts(currentCatalog, products));
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

          {purchaseLines.length > 0 && (
            <div className={styles.purchaseLineTableWrap}>
              <table className={styles.purchaseLineTable} aria-label={t("purchaseEntry.lines")}>
                <thead>
                  <tr>
                    <th aria-hidden="true" />
                    <th>{t("newSale.item")}</th>
                    <th>{t("purchase.qty")}</th>
                    <th>{t("purchaseEntry.cost")}</th>
                    <th>{t("purchaseEntry.freeQty")}</th>
                    <th>{t("purchaseEntry.lotNo")}</th>
                    <th>{t("purchaseEntry.expDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseLines.map(line => (
                    <tr key={line.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.removeLineButton}
                          aria-label={`Remove ${line.itemName}`}
                          disabled={!isEditable}
                          onClick={() => setPurchaseLines(lines => lines.filter(candidate => candidate.id !== line.id))}
                        >
                          <IconBin />
                        </button>
                      </td>
                      <td>
                        <div className={styles.purchaseLineItem}>
                          <img src={line.imageUrl} alt="" />
                          <span>{line.itemName}</span>
                        </div>
                      </td>
                      <td>{line.qty} {localizeUnit(line.unit)}</td>
                      <td>฿{line.cost}</td>
                      <td>{line.freeQty ? `${line.freeQty} ${localizeUnit(line.freeUnit)}` : "-"}</td>
                      <td>{line.lotNo || "-"}</td>
                      <td>{line.expiryDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

          {isEditable && selectedItem && (
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
          )}
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
