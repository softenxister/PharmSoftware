"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Edit3,
  MapPin,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { SalesProduct, StockItemInput } from "@/server/db/types";
import { useAuth } from "@/app/AuthProvider";
import { shouldCloseDropdown } from "@/app/dropdownInteraction";
import { usePreferences } from "@/app/PreferencesProvider";
import { localizeUnitExpression } from "@/app/i18n/productUnits";
import { buildStockCategoryOptions, getStockCategoryLabel } from "./stockCategoryFilter";
import { getStockFilterOptionLabel } from "./stockFilterLabels";
import {
  invalidateStockCatalog,
  loadStockPage,
  type StockSortDirection,
} from "./stockCatalogClient";
import { StockFilterDropdown, StockRangeFilter } from "./StockFilterDropdown";
import {
  buildFilterOptions,
  COMMON_DOSAGE_TYPES,
  EXPIRY_WINDOWS,
  filterStockInventoryItems,
  parseStockRange,
  STOCK_ADJUSTMENT_STATES,
  STOCK_LEVELS,
  type AppliedStockInventoryFilters,
  type ExpiryWindow,
  type StockLevel,
} from "./stockInventoryFilters";
import { isStockRowActivationKey } from "./stockRowInteraction";
import { StockEntryForm } from "./StockEntryForm";
import { StockBatchAdjustmentDialog } from "./StockBatchAdjustmentDialog";
import { StockItemDetailDialog } from "./StockItemDetailDialog";
import styles from "./Stock.module.css";

type StockState = "normal" | "low" | "overstock";

interface StockItem {
  id: string;
  barcodes: string[];
  name: string;
  brand: string;
  manufacturer: string;
  tagName: string;
  category: string;
  dosageType: string;
  expiryDates: string[];
  pack: string;
  min: number;
  max: number;
  stock: number;
  loc: string;
  discount: number;
  sellPrice: number;
  imageUrl: string;
  state: StockState;
}

function productToStockItem(product: SalesProduct): StockItem {
  const stock = product.batches.reduce((sum, batch) => sum + batch.availableStock, 0);
  const min = product.minimumStock ?? 20;
  const max = product.maximumStock ?? 200;
  const sellPrice = product.batches[0]?.sellPriceThb ?? 0;
  const state: StockState = stock < min ? "low" : stock > max ? "overstock" : "normal";

  return {
    id: product.barcode,
    barcodes: [
      product.barcode,
      ...(product.externalProductCode ? [product.externalProductCode] : []),
      ...(product.barcodes ?? []),
      ...product.parentPacks.flatMap((pack) => pack.barcodes ?? []),
    ],
    name: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    tagName: product.tagName ?? "",
    category: product.category,
    dosageType: product.pack.childUnit,
    expiryDates: product.batches.map((batch) => batch.expiryDate),
    pack: product.pack.label,
    min,
    max,
    stock,
    loc: product.location,
    discount: product.discountPercent ?? 0,
    sellPrice,
    imageUrl: product.imageUrl,
    state,
  };
}

function productToStockItemInput(product: SalesProduct): StockItemInput {
  const firstBatch = product.batches[0];

  return {
    productId: product.id,
    photoUrl: product.imageUrl,
    barcode: [product.barcode, ...(product.barcodes ?? [])].join(", "),
    itemName: product.itemName,
    lotNo: firstBatch?.batchNo ?? "",
    expiryDate: firstBatch?.expiryDate ?? "",
    location: product.location,
    manufacturer: product.manufacturerName,
    sellPrice: String(firstBatch?.sellPriceThb ?? ""),
    itemCategory: product.category,
    weightage: String(product.pack.childQuantity),
    subUnit: product.pack.childUnit,
    unit: product.pack.packUnit,
    brandName: product.brandName,
    packagingRows: product.parentPacks.map((pack) => ({
      parentUnit: pack.packUnit,
      childQuantity: String(pack.childPackQuantity),
      childUnit: pack.childPackUnit,
      barcode: (pack.barcodes ?? []).join(", "),
      sellPrice: pack.sellPriceThb === undefined ? "" : String(pack.sellPriceThb),
    })),
  };
}

const SIDEBAR_MIN_WIDTH = 230;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 270;
const STOCK_PAGE_SIZE = 50;

function formatPercent(value: number): string {
  return `${value}%`;
}

type StockFilterPanel =
  | "category"
  | "dosageType"
  | "expiry"
  | "stock"
  | "stockRange"
  | "manufacturer"
  | "tags"
  | "stockAdjustment";

interface DraftStockFilters {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: ExpiryWindow[];
  stockLevels: StockLevel[];
  manufacturers: string[];
  tags: string[];
  adjustmentStatuses: string[];
  minimumStock: string;
  maximumStock: string;
}

type MultiSelectFilterKey = keyof Pick<
  DraftStockFilters,
  "categories" | "dosageTypes" | "expiryWindows" | "stockLevels" | "manufacturers" | "tags" | "adjustmentStatuses"
>;

function createEmptyDraftFilters(): DraftStockFilters {
  return {
    categories: [],
    dosageTypes: [],
    expiryWindows: [],
    stockLevels: [],
    manufacturers: [],
    tags: [],
    adjustmentStatuses: [],
    minimumStock: "",
    maximumStock: "",
  };
}

function createEmptyAppliedFilters(): AppliedStockInventoryFilters {
  return {
    categories: [],
    dosageTypes: [],
    expiryWindows: [],
    stockLevels: [],
    manufacturers: [],
    tags: [],
    stockRange: null,
  };
}

function toggleSelectedOption<T extends string>(options: T[], option: string): T[] {
  const selectedOption = option as T;
  return options.includes(selectedOption)
    ? options.filter((currentOption) => currentOption !== selectedOption)
    : [...options, selectedOption];
}

export default function StockPage() {
  const { user } = useAuth();
  const { t, formatNumber, preferences } = usePreferences();
  const localizeFilterOption = useCallback(
    (option: string) => getStockFilterOptionLabel(preferences.locale, option),
    [preferences.locale],
  );
  const localizeCategoryOption = useCallback(
    (option: string) => getStockCategoryLabel(preferences.locale, option),
    [preferences.locale],
  );
  const stockStateLabel = (state: StockState) => {
    if (state === "low") return t("stock.belowMinimum");
    if (state === "overstock") return t("stock.aboveMaximum");
    return t("stock.withinRange");
  };
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [openFilterPanel, setOpenFilterPanel] = useState<StockFilterPanel | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftStockFilters>(createEmptyDraftFilters);
  const [appliedFilters, setAppliedFilters] = useState<AppliedStockInventoryFilters>(createEmptyAppliedFilters);
  const [stockWindowOpen, setStockWindowOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SalesProduct | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<SalesProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<SalesProduct | null>(null);
  const [adjustmentSuccess, setAdjustmentSuccess] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [nameSortDirection, setNameSortDirection] = useState<StockSortDirection>("asc");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [stockRefreshVersion, setStockRefreshVersion] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const filterListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), query.trim() ? 180 : 0);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setIsLoadingProducts(true);
      try {
        const result = await loadStockPage({
          page,
          pageSize: STOCK_PAGE_SIZE,
          query: debouncedQuery,
          sort: "name",
          sortDirection: nameSortDirection,
        });
        if (cancelled) return;
        if (result.products.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(result.total / STOCK_PAGE_SIZE)));
          return;
        }
        setProducts(result.products);
        setTotalProducts(result.total);
        setHasMoreProducts(result.hasMore);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, nameSortDirection, page, stockRefreshVersion]);

  useEffect(() => {
    if (!adjustmentSuccess) return;
    const timeout = window.setTimeout(() => setAdjustmentSuccess(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [adjustmentSuccess]);

  useEffect(() => {
    if (openFilterPanel === null) return;

    const closeFilterPanelOnOutsideClick = (event: PointerEvent) => {
      if (shouldCloseDropdown(filterListRef.current, event.target as Node)) {
        setOpenFilterPanel(null);
      }
    };

    document.addEventListener("pointerdown", closeFilterPanelOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeFilterPanelOnOutsideClick);
  }, [openFilterPanel]);

  const stockItems = useMemo(() => products.map(productToStockItem), [products]);

  const visibleItems = useMemo(() => {
    const filteredItems = filterStockInventoryItems(stockItems, appliedFilters);
    const q = query.trim().toLowerCase();
    if (!q) return filteredItems;

    return filteredItems
      .map((item) => {
        const itemName = item.name.toLowerCase();
        const brand = item.brand.toLowerCase();
        const manufacturer = item.manufacturer.toLowerCase();
        const priority = item.barcodes.some((barcode) => barcode.toLowerCase().includes(q))
          ? 0
          : itemName.startsWith(q)
            ? 0
            : itemName.includes(q)
              ? 1
              : brand.startsWith(q)
                ? 2
                : brand.includes(q)
                  ? 3
                  : manufacturer.startsWith(q)
                    ? 4
                    : manufacturer.includes(q)
                      ? 5
                      : null;
        return { item, priority };
      })
      .filter((result): result is { item: StockItem; priority: number } => result.priority !== null)
      .sort((a, b) => (
        a.priority - b.priority
        || a.item.name.localeCompare(b.item.name) * (nameSortDirection === "asc" ? 1 : -1)
      ))
      .map(({ item }) => item);
  }, [appliedFilters, nameSortDirection, query, stockItems]);

  const stockCategoryFilterOptions = useMemo(
    () => buildStockCategoryOptions(),
    [],
  );

  const dosageTypeFilterOptions = useMemo(
    () => buildFilterOptions(COMMON_DOSAGE_TYPES, products.map((product) => product.pack.childUnit)),
    [products],
  );

  const manufacturerFilterOptions = useMemo(
    () => buildFilterOptions([], products.map((product) => product.manufacturerName)),
    [products],
  );

  const tagFilterOptions = useMemo(
    () => buildFilterOptions([], products.map((product) => product.tagName ?? "")),
    [products],
  );

  const stockRangeResult = useMemo(
    () => parseStockRange(draftFilters.minimumStock, draftFilters.maximumStock),
    [draftFilters.maximumStock, draftFilters.minimumStock],
  );

  const openAddStock = () => {
    setEditingProduct(null);
    setStockWindowOpen(true);
  };
  const toggleNameSortDirection = () => {
    setPage(1);
    setNameSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc");
  };
  const openEditStock = (product: SalesProduct) => {
    setEditingProduct(product);
    setStockWindowOpen(true);
  };
  const openEditStockByBarcode = (barcode: string) => {
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) openEditStock(product);
  };
  const openStockAdjustmentByBarcode = (barcode: string) => {
    if (user?.role !== "owner") return;
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) setAdjustmentProduct(product);
  };
  const openItemDetailByBarcode = (barcode: string) => {
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) setDetailProduct(product);
  };
  const replaceVisibleProduct = (nextProduct: SalesProduct) => {
    setProducts((currentProducts) => {
      const exists = currentProducts.some((product) => product.id === nextProduct.id);
      return exists
        ? currentProducts.map((product) => product.id === nextProduct.id ? nextProduct : product)
        : [nextProduct, ...currentProducts].slice(0, STOCK_PAGE_SIZE);
    });
  };
  const handleItemDetailSaved = (nextProduct: SalesProduct) => {
    replaceVisibleProduct(nextProduct);
    invalidateStockCatalog();
    setDetailProduct(null);
  };
  const handleStockAdjustmentUpdated = (
    productId: string,
    quantities: Array<{ batchNo: string; availableStock: number }>,
  ) => {
    const quantityByBatch = new Map(quantities.map((quantity) => [quantity.batchNo, quantity.availableStock]));
    const nextProducts = products.map((product) => product.id !== productId ? product : ({
      ...product,
      batches: product.batches.map((batch) => quantityByBatch.has(batch.batchNo) ? ({
        ...batch,
        availableStock: quantityByBatch.get(batch.batchNo) ?? batch.availableStock,
      }) : batch),
    }));
    setProducts(nextProducts);
    setAdjustmentProduct(null);
    setAdjustmentSuccess(true);
    invalidateStockCatalog();
  };
  const closeAddStock = () => {
    setStockWindowOpen(false);
    setEditingProduct(null);
  };
  const toggleFilterPanel = (panel: StockFilterPanel) => {
    setOpenFilterPanel((openPanel) => openPanel === panel ? null : panel);
  };
  const toggleDraftFilterOption = (filter: MultiSelectFilterKey, option: string) => {
    setDraftFilters((currentFilters) => {
      if (filter === "categories") {
        return { ...currentFilters, categories: toggleSelectedOption(currentFilters.categories, option) };
      }
      if (filter === "dosageTypes") {
        return { ...currentFilters, dosageTypes: toggleSelectedOption(currentFilters.dosageTypes, option) };
      }
      if (filter === "expiryWindows") {
        return { ...currentFilters, expiryWindows: toggleSelectedOption(currentFilters.expiryWindows, option) };
      }
      if (filter === "stockLevels") {
        return { ...currentFilters, stockLevels: toggleSelectedOption(currentFilters.stockLevels, option) };
      }
      if (filter === "manufacturers") {
        return { ...currentFilters, manufacturers: toggleSelectedOption(currentFilters.manufacturers, option) };
      }
      if (filter === "tags") {
        return { ...currentFilters, tags: toggleSelectedOption(currentFilters.tags, option) };
      }
      return {
        ...currentFilters,
        adjustmentStatuses: toggleSelectedOption(currentFilters.adjustmentStatuses, option),
      };
    });
  };
  const resetStockFilters = () => {
    setDraftFilters(createEmptyDraftFilters());
    setAppliedFilters(createEmptyAppliedFilters());
    setOpenFilterPanel(null);
  };
  const applyStockFilters = () => {
    if (!stockRangeResult.isValid) return;
    setAppliedFilters({
      categories: draftFilters.categories,
      dosageTypes: draftFilters.dosageTypes,
      expiryWindows: draftFilters.expiryWindows,
      stockLevels: draftFilters.stockLevels,
      manufacturers: draftFilters.manufacturers,
      tags: draftFilters.tags,
      stockRange: stockRangeResult.range,
    });
    setOpenFilterPanel(null);
  };
  const handleSidebarResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + moveEvent.clientX - startX),
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  const handleSaveStock = async (item: StockItemInput) => {
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await response.json() as { product?: SalesProduct; error?: string };
      if (!response.ok || !data.product) throw new Error(data.error || "Unable to save stock item.");
      replaceVisibleProduct(data.product);
      invalidateStockCatalog();
      setStockRefreshVersion((version) => version + 1);
      closeAddStock();
    } catch (error) {
      console.error(error);
    }
  };
  const handleDeleteStock = async () => {
    if (!editingProduct) throw new Error("No stock item is selected.");
    const response = await fetch("/api/stock", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: editingProduct.id }),
    });
    const data = await response.json() as { deletedProductId?: string; error?: string };
    if (!response.ok || data.deletedProductId !== editingProduct.id) {
      throw new Error(data.error || "Unable to delete stock item.");
    }

    setProducts((currentProducts) => currentProducts.filter((product) => product.id !== data.deletedProductId));
    setTotalProducts((total) => Math.max(0, total - 1));
    invalidateStockCatalog();
    setStockRefreshVersion((version) => version + 1);
    closeAddStock();
  };

  return (
    <div className={styles.page}>
      <aside
        className={`${styles.sidebar} ${!isFilterOpen ? styles.sidebarClosed : ""}`}
        aria-label={t("stock.filters")}
        style={isFilterOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}
      >
        <div className={styles.sidebarHeader}>
          {isFilterOpen ? (
            <>
              <div className={styles.sidebarHeading}>
                <h1 className={styles.sidebarTitle}>{t("stock.inventory")}</h1>
              </div>
              <button
                type="button"
                className={styles.sidebarIconButton}
                onClick={() => setIsFilterOpen(false)}
                title={t("stock.closeFilters")}
                aria-label={t("stock.closeFilters")}
              >
                <span className={`${styles.sidebarToggleGlyph} ${styles.sidebarToggleGlyphOpen}`} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.sidebarIconButton}
              onClick={() => setIsFilterOpen(true)}
              title={t("stock.openFilters")}
              aria-label={t("stock.openFilters")}
            >
              <span className={styles.sidebarToggleGlyph} aria-hidden="true" />
            </button>
          )}
        </div>

        {isFilterOpen && (
          <>
            <button type="button" className={`${styles.addStockButton} ${styles.createActionButton}`} onClick={openAddStock}>
              <Plus size={17} />
              <span>{t("stock.createItem")}</span>
            </button>

            <div className={styles.filterList} ref={filterListRef}>
              <button type="button" className={styles.filterButton}>
                <span className={styles.filterText}>
                  <span className={styles.filterLabel}>{t("stock.items")}</span>
                </span>
                <ChevronDown size={16} />
              </button>

              <StockFilterDropdown
                id="stock-category-options"
                label={t("stock.category")}
                options={stockCategoryFilterOptions}
                selectedOptions={draftFilters.categories}
                isOpen={openFilterPanel === "category"}
                onToggle={() => toggleFilterPanel("category")}
                onToggleOption={(option) => toggleDraftFilterOption("categories", option)}
                getOptionLabel={localizeCategoryOption}
              />

              <StockFilterDropdown
                id="stock-dosage-type-options"
                label={t("stock.dosageType")}
                options={dosageTypeFilterOptions}
                selectedOptions={draftFilters.dosageTypes}
                isOpen={openFilterPanel === "dosageType"}
                onToggle={() => toggleFilterPanel("dosageType")}
                onToggleOption={(option) => toggleDraftFilterOption("dosageTypes", option)}
                getOptionLabel={localizeFilterOption}
              />

              <button type="button" className={styles.filterButton}>
                <span className={styles.filterText}>
                  <span className={styles.filterLabel}>{t("stock.scheduleType")}</span>
                </span>
                <ChevronDown size={16} />
              </button>

              <StockFilterDropdown
                id="stock-expiry-options"
                label={t("stock.expiry")}
                options={EXPIRY_WINDOWS}
                selectedOptions={draftFilters.expiryWindows}
                isOpen={openFilterPanel === "expiry"}
                onToggle={() => toggleFilterPanel("expiry")}
                onToggleOption={(option) => toggleDraftFilterOption("expiryWindows", option)}
                searchable={false}
                getOptionLabel={localizeFilterOption}
              />

              <StockFilterDropdown
                id="stock-level-options"
                label={t("nav.stock")}
                options={STOCK_LEVELS}
                selectedOptions={draftFilters.stockLevels}
                isOpen={openFilterPanel === "stock"}
                onToggle={() => toggleFilterPanel("stock")}
                onToggleOption={(option) => toggleDraftFilterOption("stockLevels", option)}
                searchable={false}
                getOptionLabel={localizeFilterOption}
              />

              <StockRangeFilter
                isOpen={openFilterPanel === "stockRange"}
                minimum={draftFilters.minimumStock}
                maximum={draftFilters.maximumStock}
                isValid={stockRangeResult.isValid}
                onToggle={() => toggleFilterPanel("stockRange")}
                onMinimumChange={(minimumStock) => setDraftFilters((filters) => ({ ...filters, minimumStock }))}
                onMaximumChange={(maximumStock) => setDraftFilters((filters) => ({ ...filters, maximumStock }))}
              />

              <StockFilterDropdown
                id="stock-manufacturer-options"
                label={t("stock.manufacturer")}
                options={manufacturerFilterOptions}
                selectedOptions={draftFilters.manufacturers}
                isOpen={openFilterPanel === "manufacturer"}
                onToggle={() => toggleFilterPanel("manufacturer")}
                onToggleOption={(option) => toggleDraftFilterOption("manufacturers", option)}
              />

              <StockFilterDropdown
                id="stock-tag-options"
                label={t("stock.tags")}
                options={tagFilterOptions}
                selectedOptions={draftFilters.tags}
                isOpen={openFilterPanel === "tags"}
                onToggle={() => toggleFilterPanel("tags")}
                onToggleOption={(option) => toggleDraftFilterOption("tags", option)}
              />

              <StockFilterDropdown
                id="stock-adjustment-options"
                label={t("stock.adjustment")}
                options={STOCK_ADJUSTMENT_STATES}
                selectedOptions={draftFilters.adjustmentStatuses}
                isOpen={openFilterPanel === "stockAdjustment"}
                onToggle={() => toggleFilterPanel("stockAdjustment")}
                onToggleOption={(option) => toggleDraftFilterOption("adjustmentStatuses", option)}
                searchable={false}
                helperText={t("stock.adjustmentFilterNote")}
                getOptionLabel={localizeFilterOption}
              />
            </div>

            <div className={styles.sidebarActions}>
              <button type="button" className={styles.resetButton} onClick={resetStockFilters}>
                {t("stock.reset")}
              </button>
              <button
                type="button"
                className={styles.applyButton}
                onClick={applyStockFilters}
                disabled={!stockRangeResult.isValid}
              >
                {t("stock.applyFilter")}
              </button>
            </div>
          </>
        )}
        {isFilterOpen && (
          <div
            className={styles.sidebarResizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("stock.resizeFilters")}
            onMouseDown={handleSidebarResizeStart}
          />
        )}
      </aside>

      <section className={styles.content}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={17} className={styles.searchIcon} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("stock.search")}
            />
          </label>

          <div className={styles.toolbarSpacer} />

          <button type="button" className={styles.moreButton}>
            <SlidersHorizontal size={17} />
            <span>{t("nav.more")}</span>
            <ChevronDown size={15} />
          </button>

          <button type="button" className={`${styles.toolbarAddButton} ${styles.createActionButton}`} onClick={openAddStock}>
            <PackagePlus size={17} />
            <span>{t("stock.createItem")}</span>
          </button>
        </div>

        <div className={styles.tablePanel}>
          <div className={styles.tableHeader}>
            <div>
              <h2>{t("stock.items")}</h2>
              <p>{t("stock.found", { count: totalProducts })}</p>
            </div>
            <div className={styles.tableSummary}>
              <span>{t("stock.lowCount", { count: stockItems.filter((item) => item.state === "low").length })}</span>
              <span>{t("stock.overCount", { count: stockItems.filter((item) => item.state === "overstock").length })}</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    className={styles.itemCol}
                    aria-sort={nameSortDirection === "asc" ? "ascending" : "descending"}
                  >
                    <button
                      type="button"
                      className={`${styles.headerCell} ${styles.sortButton}`}
                      onClick={toggleNameSortDirection}
                      aria-label={t("member.sortBy", { label: t("stock.itemName") })}
                    >
                      <span>{t("stock.itemName")}</span>
                      {nameSortDirection === "asc"
                        ? <ArrowUp size={14} aria-hidden="true" />
                        : <ArrowDown size={14} aria-hidden="true" />}
                    </button>
                  </th>
                  <th>{t("stock.minimumShort")}</th>
                  <th>{t("stock.maximumShort")}</th>
                  <th>{t("nav.stock")}</th>
                  <th>{t("stock.locationShort")}</th>
                  <th>{t("stock.discountShort")}</th>
                  <th>{t("stock.sellPrice")}</th>
                  <th className={styles.actionCol} aria-label={t("stock.itemActions")} />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    aria-label={t("stock.editItemFor", { name: item.name })}
                    onClick={() => openEditStockByBarcode(item.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || !isStockRowActivationKey(event.key)) return;
                      event.preventDefault();
                      openEditStockByBarcode(item.id);
                    }}
                  >
                    <td>
                      <span className={styles.itemCell}>
                        <span className={styles.productImageFrame}>
                          <img src={item.imageUrl} alt={t("stock.productImage", { name: item.name })} className={styles.productImage} />
                        </span>
                        <span className={styles.itemInfo}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.itemMeta}>
                            {item.brand}
                            <span aria-hidden="true">|</span>
                            {localizeUnitExpression(preferences.locale, item.pack)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>{item.min}</td>
                    <td>{item.max}</td>
                    <td>
                      <span
                        className={`${styles.stockValue} ${
                          item.state === "low"
                            ? styles.stockValueLow
                            : item.state === "overstock"
                              ? styles.stockValueOver
                              : styles.stockValueNormal
                        }`}
                        title={stockStateLabel(item.state)}
                        aria-label={t("stock.unitsState", { count: item.stock, state: stockStateLabel(item.state) })}
                      >
                        {item.stock}
                      </span>
                    </td>
                    <td>
                      <span className={styles.locationValue} title={item.loc}>
                        <MapPin size={13} />
                        {item.loc}
                      </span>
                    </td>
                    <td>{formatPercent(item.discount)}</td>
                    <td>
                      <span className={styles.priceValue}>฿{formatNumber(item.sellPrice, { maximumFractionDigits: 0 })}</span>
                    </td>
                    <td>
                      <span className={styles.actionCell}>
                        {user?.role === "owner" && (
                          <button
                            type="button"
                            className={styles.actionButton}
                            title={t("stock.adjust")}
                            aria-label={t("stock.adjustFor", { name: item.name })}
                            onClick={(event) => {
                              event.stopPropagation();
                              openStockAdjustmentByBarcode(item.id);
                            }}
                          >
                            <PackagePlus size={17} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.actionButton}
                          title={t("stock.setItemDetail")}
                          aria-label={t("stock.setItemDetailFor", { name: item.name })}
                          onClick={(event) => {
                            event.stopPropagation();
                            openItemDetailByBarcode(item.id);
                          }}
                        >
                          <Edit3 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleItems.length === 0 && !isLoadingProducts && (
              <div className={styles.emptyState}>
                <strong>{t("stock.none")}</strong>
                <span>{t("stock.noneHint")}</span>
              </div>
            )}
          </div>
          <div className={styles.pagination} aria-label={t("stock.pages")}>
            <span>
              {isLoadingProducts
                ? t("common.loading")
                : t("stock.pageOf", { page, pages: Math.max(1, Math.ceil(totalProducts / STOCK_PAGE_SIZE)) })}
            </span>
            <div className={styles.paginationButtons}>
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page === 1 || isLoadingProducts}
                aria-label={t("stock.previousPage")}
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                onClick={() => setPage((currentPage) => currentPage + 1)}
                disabled={!hasMoreProducts || isLoadingProducts}
                aria-label={t("stock.nextPage")}
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {stockWindowOpen && (
        <div className={styles.stockWindowBackdrop} role="presentation" onMouseDown={closeAddStock}>
          <section
            className={styles.stockEntryWindow}
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? t("stock.editDialog", { name: editingProduct.itemName }) : t("stock.createDialog")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <StockEntryForm
              key={editingProduct?.id ?? "new-item"}
              initialItem={editingProduct ? productToStockItemInput(editingProduct) : undefined}
              activeIngredients={editingProduct?.activeIngredients}
              compositionStatus={editingProduct?.compositionStatus}
              mode={editingProduct ? "edit" : "create"}
              onSave={handleSaveStock}
              onDelete={editingProduct ? handleDeleteStock : undefined}
            />
          </section>
        </div>
      )}
      {adjustmentProduct && user?.role === "owner" && (
        <StockBatchAdjustmentDialog
          product={adjustmentProduct}
          onClose={() => setAdjustmentProduct(null)}
          onUpdated={handleStockAdjustmentUpdated}
        />
      )}
      {detailProduct && user && (
        <StockItemDetailDialog
          product={detailProduct}
          role={user.role}
          onClose={() => setDetailProduct(null)}
          onSaved={handleItemDetailSaved}
        />
      )}
      {adjustmentSuccess && (
        <div className={styles.adjustmentSuccessToast} role="status">
          <CheckCircle2 size={17} />
          <span>{t("stock.adjustmentSaved")}</span>
        </div>
      )}
    </div>
  );
}
