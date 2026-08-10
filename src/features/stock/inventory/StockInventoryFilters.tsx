import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronDown, Plus } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { shouldCloseDropdown } from "@/lib/dropdownInteraction";
import {
  buildStockCategoryOptions,
  getStockCategoryLabel,
} from "@/features/stock/stockCategoryFilter";
import { getStockFilterOptionLabel } from "@/features/stock/stockFilterLabels";
import {
  StockFilterDropdown,
  StockRangeFilter,
} from "@/features/stock/StockFilterDropdown";
import {
  clampStockSidebarWidth,
  EXPIRY_WINDOWS,
  reopenStockSidebarFromEdgeDrag,
  resizeStockSidebarFromDrag,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  STOCK_LEVELS,
  type StockSidebarDragResult,
} from "./stockInventoryModel";
import type { StockInventoryController } from "./useStockInventory";
import styles from "@/features/stock/Stock.module.css";

export function StockInventoryFilters({
  controller,
}: {
  controller: StockInventoryController;
}) {
  const { t, preferences } = usePreferences();
  const { filters } = controller;
  const filterListRef = useRef<HTMLDivElement>(null);
  const categoryOptions = buildStockCategoryOptions();
  const localizeFilterOption = useCallback(
    (option: string) => getStockFilterOptionLabel(preferences.locale, option),
    [preferences.locale],
  );
  const localizeCategoryOption = useCallback(
    (option: string) => getStockCategoryLabel(preferences.locale, option),
    [preferences.locale],
  );

  useEffect(() => {
    if (filters.openPanel === null) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (shouldCloseDropdown(filterListRef.current, event.target as Node)) {
        filters.closePanel();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [filters]);

  const applySidebarDrag = ({ isClosed, width }: StockSidebarDragResult) => {
    filters.setSidebarWidth(width);
    filters.setIsSidebarClosed(isClosed);
  };

  const beginResize = (
    event: ReactMouseEvent<HTMLDivElement>,
    projectDrag: (pointerDelta: number) => StockSidebarDragResult,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const resize = (moveEvent: MouseEvent) => {
      applySidebarDrag(projectDrag(moveEvent.clientX - startX));
    };
    const stopResize = () => {
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResize);
    };
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResize);
  };

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    const startWidth = filters.sidebarWidth;
    beginResize(event, (pointerDelta) => resizeStockSidebarFromDrag(startWidth, pointerDelta));
  };

  const startEdgeResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    beginResize(event, reopenStockSidebarFromEdgeDrag);
  };

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (event.key === "ArrowLeft" && filters.sidebarWidth === SIDEBAR_MIN_WIDTH) {
      filters.setIsSidebarClosed(true);
      return;
    }
    filters.setSidebarWidth(clampStockSidebarWidth(
      filters.sidebarWidth + (event.key === "ArrowLeft" ? -10 : 10),
    ));
  };

  const reopenWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    filters.setSidebarWidth(SIDEBAR_MIN_WIDTH);
    filters.setIsSidebarClosed(false);
  };

  return (
    <>
      <aside
        className={`${styles.sidebar} ${filters.isSidebarClosed ? styles.sidebarClosed : ""}`}
        aria-label={t("stock.filters")}
        aria-hidden={filters.isSidebarClosed}
        inert={filters.isSidebarClosed}
        style={filters.isSidebarClosed
          ? undefined
          : { width: filters.sidebarWidth, minWidth: filters.sidebarWidth }}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeading}>
            <h1 className={styles.sidebarTitle}>{t("stock.inventory")}</h1>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.addStockButton} ${styles.createActionButton}`}
          onClick={controller.productEntry.openCreate}
        >
          <Plus size={17} aria-hidden="true" />
          <span>{t("stock.createItem")}</span>
        </button>

        <div className={styles.filterList} ref={filterListRef}>
          <button type="button" className={styles.filterButton}>
            <span className={styles.filterText}>
              <span className={styles.filterLabel}>{t("stock.items")}</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <StockFilterDropdown
            id="stock-category-options"
            label={t("stock.category")}
            options={categoryOptions}
            selectedOptions={filters.draft.categories}
            isOpen={filters.openPanel === "category"}
            onToggle={() => filters.togglePanel("category")}
            onToggleOption={(option) => filters.toggleOption("categories", option)}
            getOptionLabel={localizeCategoryOption}
          />
          <StockFilterDropdown
            id="stock-dosage-type-options"
            label={t("stock.dosageType")}
            options={filters.dosageTypeOptions}
            selectedOptions={filters.draft.dosageTypes}
            isOpen={filters.openPanel === "dosageType"}
            onToggle={() => filters.togglePanel("dosageType")}
            onToggleOption={(option) => filters.toggleOption("dosageTypes", option)}
            getOptionLabel={localizeFilterOption}
          />
          <button type="button" className={styles.filterButton}>
            <span className={styles.filterText}>
              <span className={styles.filterLabel}>{t("stock.scheduleType")}</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <StockFilterDropdown
            id="stock-expiry-options"
            label={t("stock.expiry")}
            options={EXPIRY_WINDOWS}
            selectedOptions={filters.draft.expiryWindows}
            isOpen={filters.openPanel === "expiry"}
            onToggle={() => filters.togglePanel("expiry")}
            onToggleOption={(option) => filters.toggleOption("expiryWindows", option)}
            searchable={false}
            getOptionLabel={localizeFilterOption}
          />
          <StockFilterDropdown
            id="stock-level-options"
            label={t("nav.stock")}
            options={STOCK_LEVELS}
            selectedOptions={filters.draft.stockLevels}
            isOpen={filters.openPanel === "stock"}
            onToggle={() => filters.togglePanel("stock")}
            onToggleOption={(option) => filters.toggleOption("stockLevels", option)}
            searchable={false}
            getOptionLabel={localizeFilterOption}
          />
          <StockRangeFilter
            isOpen={filters.openPanel === "stockRange"}
            minimum={filters.draft.minimumStock}
            maximum={filters.draft.maximumStock}
            isValid={filters.range.isValid}
            onToggle={() => filters.togglePanel("stockRange")}
            onMinimumChange={(value) => filters.setRange("minimumStock", value)}
            onMaximumChange={(value) => filters.setRange("maximumStock", value)}
          />
          <StockFilterDropdown
            id="stock-manufacturer-options"
            label={t("stock.manufacturer")}
            options={filters.manufacturerOptions}
            selectedOptions={filters.draft.manufacturers}
            isOpen={filters.openPanel === "manufacturer"}
            onToggle={() => filters.togglePanel("manufacturer")}
            onToggleOption={(option) => filters.toggleOption("manufacturers", option)}
          />
          <StockFilterDropdown
            id="stock-tag-options"
            label={t("stock.tags")}
            options={filters.tagOptions}
            selectedOptions={filters.draft.tags}
            isOpen={filters.openPanel === "tags"}
            onToggle={() => filters.togglePanel("tags")}
            onToggleOption={(option) => filters.toggleOption("tags", option)}
          />
        </div>
        <div className={styles.sidebarActions}>
          <button type="button" className={styles.resetButton} onClick={filters.reset}>
            {t("stock.reset")}
          </button>
          <button
            type="button"
            className={styles.applyButton}
            onClick={filters.apply}
            disabled={!filters.range.isValid}
          >
            {t("stock.applyFilter")}
          </button>
        </div>

        {!filters.isSidebarClosed && (
          <div
            className={styles.sidebarResizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("stock.resizeFilters")}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuenow={filters.sidebarWidth}
            tabIndex={0}
            onKeyDown={resizeWithKeyboard}
            onMouseDown={startResize}
          />
        )}
      </aside>

      {filters.isSidebarClosed && (
        <div
          className={styles.sidebarEdgeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("stock.resizeFilters")}
          aria-valuemin={0}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={0}
          tabIndex={0}
          onKeyDown={reopenWithKeyboard}
          onMouseDown={startEdgeResize}
        />
      )}
    </>
  );
}
