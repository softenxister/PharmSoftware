"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  Edit3,
  MapPin,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { SalesProduct, StockItemInput } from "@/server/db/types";
import { buildStockCategoryOptions } from "./stockCategoryFilter";
import { loadStockCatalog, updateStockCatalog } from "./stockCatalogClient";
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
import styles from "./Stock.module.css";

type StockState = "normal" | "low" | "overstock";

interface StockItem {
  id: string;
  name: string;
  brand: string;
  manufacturer: string;
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

function productToStockItem(product: SalesProduct, index: number): StockItem {
  const stock = product.batches.reduce((sum, batch) => sum + batch.availableStock, 0);
  const min = Math.max(8, Math.round(product.weeklySold * 0.16));
  const max = Math.max(min + 24, Math.round(product.weeklySold * 0.8));
  const sellPrice = product.batches[0]?.sellPriceThb ?? 0;
  const state: StockState = stock < min ? "low" : stock > max ? "overstock" : "normal";

  return {
    id: product.barcode,
    name: product.itemName,
    brand: product.brandName,
    manufacturer: product.manufacturerName,
    category: product.category,
    dosageType: product.pack.childUnit,
    expiryDates: product.batches.map((batch) => batch.expiryDate),
    pack: product.pack.label,
    min,
    max,
    stock,
    loc: product.location,
    discount: index % 4 === 0 ? 2 : index % 5 === 0 ? 1.5 : 0,
    sellPrice,
    imageUrl: product.imageUrl,
    state,
  };
}

function productToStockItemInput(product: SalesProduct): StockItemInput {
  const firstBatch = product.batches[0];

  return {
    photoUrl: product.imageUrl,
    barcode: product.barcode,
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
      barcode: "",
    })),
  };
}

const SIDEBAR_MIN_WIDTH = 230;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 270;

function formatMoney(value: number): string {
  return `฿${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function stockStateLabel(state: StockState): string {
  if (state === "low") return "Below minimum";
  if (state === "overstock") return "Above maximum";
  return "Within range";
}

type StockFilterPanel =
  | "category"
  | "dosageType"
  | "expiry"
  | "stock"
  | "stockRange"
  | "manufacturer"
  | "stockAdjustment";

interface DraftStockFilters {
  categories: string[];
  dosageTypes: string[];
  expiryWindows: ExpiryWindow[];
  stockLevels: StockLevel[];
  manufacturers: string[];
  adjustmentStatuses: string[];
  minimumStock: string;
  maximumStock: string;
}

type MultiSelectFilterKey = keyof Pick<
  DraftStockFilters,
  "categories" | "dosageTypes" | "expiryWindows" | "stockLevels" | "manufacturers" | "adjustmentStatuses"
>;

function createEmptyDraftFilters(): DraftStockFilters {
  return {
    categories: [],
    dosageTypes: [],
    expiryWindows: [],
    stockLevels: [],
    manufacturers: [],
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
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [openFilterPanel, setOpenFilterPanel] = useState<StockFilterPanel | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftStockFilters>(createEmptyDraftFilters);
  const [appliedFilters, setAppliedFilters] = useState<AppliedStockInventoryFilters>(createEmptyAppliedFilters);
  const [stockWindowOpen, setStockWindowOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SalesProduct | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [products, setProducts] = useState<SalesProduct[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const nextProducts = await loadStockCatalog();
        if (!cancelled) setProducts(nextProducts);
      } catch (error) {
        console.error(error);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const stockItems = useMemo(() => products.map(productToStockItem), [products]);

  const visibleItems = useMemo(() => {
    const filteredItems = filterStockInventoryItems(stockItems, appliedFilters);
    const q = query.trim().toLowerCase();
    if (!q) return filteredItems;

    return filteredItems.filter((item) =>
      [item.name, item.brand, item.manufacturer, item.category, item.pack, item.loc, item.id].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [appliedFilters, query, stockItems]);

  const stockCategoryFilterOptions = useMemo(
    () => buildStockCategoryOptions(products.map((product) => product.category)),
    [products],
  );

  const dosageTypeFilterOptions = useMemo(
    () => buildFilterOptions(COMMON_DOSAGE_TYPES, products.map((product) => product.pack.childUnit)),
    [products],
  );

  const manufacturerFilterOptions = useMemo(
    () => buildFilterOptions([], products.map((product) => product.manufacturerName)),
    [products],
  );

  const stockRangeResult = useMemo(
    () => parseStockRange(draftFilters.minimumStock, draftFilters.maximumStock),
    [draftFilters.maximumStock, draftFilters.minimumStock],
  );

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();

    return products.reduce<string[]>((options, product) => {
      const category = product.category.trim();
      const key = category.toLowerCase();
      if (!category || seen.has(key)) return options;
      seen.add(key);
      options.push(category);
      return options;
    }, []);
  }, [products]);

  const openAddStock = () => {
    setEditingProduct(null);
    setStockWindowOpen(true);
  };
  const openEditStock = (product: SalesProduct) => {
    setEditingProduct(product);
    setStockWindowOpen(true);
  };
  const openEditStockByBarcode = (barcode: string) => {
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) openEditStock(product);
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
      if (!response.ok) throw new Error("Unable to save stock item.");
      const data = await response.json() as { products?: SalesProduct[] };
      if (Array.isArray(data.products)) {
        updateStockCatalog(data.products);
        setProducts(data.products);
      }
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
    const data = await response.json() as { products?: SalesProduct[]; error?: string };
    if (!response.ok || !Array.isArray(data.products)) {
      throw new Error(data.error || "Unable to delete stock item.");
    }

    updateStockCatalog(data.products);
    setProducts(data.products);
    closeAddStock();
  };

  return (
    <div className={styles.page}>
      <aside
        className={`${styles.sidebar} ${!isFilterOpen ? styles.sidebarClosed : ""}`}
        aria-label="Stock filters"
        style={isFilterOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}
      >
        <div className={styles.sidebarHeader}>
          {isFilterOpen ? (
            <>
              <div className={styles.sidebarHeading}>
                <h1 className={styles.sidebarTitle}>Inventory Stock</h1>
              </div>
              <button
                type="button"
                className={styles.sidebarIconButton}
                onClick={() => setIsFilterOpen(false)}
                title="Close filter bar"
                aria-label="Close filter bar"
              >
                <span className={`${styles.sidebarToggleGlyph} ${styles.sidebarToggleGlyphOpen}`} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.sidebarIconButton}
              onClick={() => setIsFilterOpen(true)}
              title="Open filter bar"
              aria-label="Open filter bar"
            >
              <span className={styles.sidebarToggleGlyph} aria-hidden="true" />
            </button>
          )}
        </div>

        {isFilterOpen && (
          <>
            <button type="button" className={styles.addStockButton} onClick={openAddStock}>
              <Plus size={17} />
              <span>Create New Item</span>
            </button>

            <div className={styles.filterList}>
              <button type="button" className={styles.filterButton}>
                <span className={styles.filterText}>
                  <span className={styles.filterLabel}>Items</span>
                </span>
                <ChevronDown size={16} />
              </button>

              <StockFilterDropdown
                id="stock-category-options"
                label="Category"
                options={stockCategoryFilterOptions}
                selectedOptions={draftFilters.categories}
                isOpen={openFilterPanel === "category"}
                onToggle={() => toggleFilterPanel("category")}
                onToggleOption={(option) => toggleDraftFilterOption("categories", option)}
              />

              <StockFilterDropdown
                id="stock-dosage-type-options"
                label="Dosage Type"
                options={dosageTypeFilterOptions}
                selectedOptions={draftFilters.dosageTypes}
                isOpen={openFilterPanel === "dosageType"}
                onToggle={() => toggleFilterPanel("dosageType")}
                onToggleOption={(option) => toggleDraftFilterOption("dosageTypes", option)}
              />

              <button type="button" className={styles.filterButton}>
                <span className={styles.filterText}>
                  <span className={styles.filterLabel}>Schedule Type</span>
                </span>
                <ChevronDown size={16} />
              </button>

              <StockFilterDropdown
                id="stock-expiry-options"
                label="Expiry"
                options={EXPIRY_WINDOWS}
                selectedOptions={draftFilters.expiryWindows}
                isOpen={openFilterPanel === "expiry"}
                onToggle={() => toggleFilterPanel("expiry")}
                onToggleOption={(option) => toggleDraftFilterOption("expiryWindows", option)}
                searchable={false}
              />

              <StockFilterDropdown
                id="stock-level-options"
                label="Stock"
                options={STOCK_LEVELS}
                selectedOptions={draftFilters.stockLevels}
                isOpen={openFilterPanel === "stock"}
                onToggle={() => toggleFilterPanel("stock")}
                onToggleOption={(option) => toggleDraftFilterOption("stockLevels", option)}
                searchable={false}
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
                label="Manufacturer"
                options={manufacturerFilterOptions}
                selectedOptions={draftFilters.manufacturers}
                isOpen={openFilterPanel === "manufacturer"}
                onToggle={() => toggleFilterPanel("manufacturer")}
                onToggleOption={(option) => toggleDraftFilterOption("manufacturers", option)}
              />

              <StockFilterDropdown
                id="stock-adjustment-options"
                label="Stock Adjustment"
                options={STOCK_ADJUSTMENT_STATES}
                selectedOptions={draftFilters.adjustmentStatuses}
                isOpen={openFilterPanel === "stockAdjustment"}
                onToggle={() => toggleFilterPanel("stockAdjustment")}
                onToggleOption={(option) => toggleDraftFilterOption("adjustmentStatuses", option)}
                searchable={false}
                helperText="Stock items do not currently include adjustment status, so these selections do not filter the item table."
              />
            </div>

            <div className={styles.sidebarActions}>
              <button type="button" className={styles.resetButton} onClick={resetStockFilters}>
                Reset
              </button>
              <button
                type="button"
                className={styles.applyButton}
                onClick={applyStockFilters}
                disabled={!stockRangeResult.isValid}
              >
                Apply Filter
              </button>
            </div>
          </>
        )}
        {isFilterOpen && (
          <div
            className={styles.sidebarResizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inventory stock bar"
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
              placeholder="Search item, location, brand, manufacturer, category, or barcode"
            />
          </label>

          <div className={styles.toolbarSpacer} />

          <button type="button" className={styles.moreButton}>
            <SlidersHorizontal size={17} />
            <span>More</span>
            <ChevronDown size={15} />
          </button>

          <button type="button" className={styles.toolbarAddButton} onClick={openAddStock}>
            <PackagePlus size={17} />
            <span>Create New Item</span>
          </button>
        </div>

        <div className={styles.tablePanel}>
          <div className={styles.tableHeader}>
            <div>
              <h2>Items</h2>
              <p>{visibleItems.length} stocked items found</p>
            </div>
            <div className={styles.tableSummary}>
              <span>{stockItems.filter((item) => item.state === "low").length} low stock</span>
              <span>{stockItems.filter((item) => item.state === "overstock").length} over max</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.itemCol}>
                    <span className={styles.headerCell}>
                      Item name <ChevronsUpDown size={14} />
                    </span>
                  </th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Stock</th>
                  <th>Loc.</th>
                  <th>Disc.</th>
                  <th>Sell price</th>
                  <th className={styles.actionCol} aria-label="Item actions" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    aria-label={`Edit item detail for ${item.name}`}
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
                          <img src={item.imageUrl} alt={`${item.name} product`} className={styles.productImage} />
                        </span>
                        <span className={styles.itemInfo}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.itemMeta}>
                            {item.brand}
                            <span aria-hidden="true">|</span>
                            {item.pack}
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
                        aria-label={`${item.stock} units, ${stockStateLabel(item.state).toLowerCase()}`}
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
                      <span className={styles.priceValue}>{formatMoney(item.sellPrice)}</span>
                    </td>
                    <td>
                      <span className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          title="Adjust stock"
                          aria-label={`Adjust stock for ${item.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <PackagePlus size={17} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionButton}
                          title="Edit item detail"
                          aria-label={`Edit item detail for ${item.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditStockByBarcode(item.id);
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

            {visibleItems.length === 0 && (
              <div className={styles.emptyState}>
                <strong>No stock items found</strong>
                <span>Try a different item name, location, brand, manufacturer, category, or barcode.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {stockWindowOpen && (
        <div className={styles.stockWindowBackdrop} role="presentation" onMouseDown={closeAddStock}>
          <section
            className={styles.stockEntryWindow}
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? `Edit ${editingProduct.itemName}` : "Create new item"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <StockEntryForm
              key={editingProduct?.id ?? "new-item"}
              categoryOptions={categoryOptions}
              initialItem={editingProduct ? productToStockItemInput(editingProduct) : undefined}
              mode={editingProduct ? "edit" : "create"}
              onSave={handleSaveStock}
              onDelete={editingProduct ? handleDeleteStock : undefined}
            />
          </section>
        </div>
      )}
    </div>
  );
}
