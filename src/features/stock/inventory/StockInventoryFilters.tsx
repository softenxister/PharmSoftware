import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
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
  EXPIRY_WINDOWS,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  STOCK_ADJUSTMENT_STATES,
  STOCK_LEVELS,
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

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = filters.sidebarWidth;
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const resize = (moveEvent: MouseEvent) => {
      filters.setSidebarWidth(Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + moveEvent.clientX - startX),
      ));
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

  return (
    <aside
      className={`${styles.sidebar} ${!filters.isOpen ? styles.sidebarClosed : ""}`}
      aria-label={t("stock.filters")}
      style={filters.isOpen
        ? { width: filters.sidebarWidth, minWidth: filters.sidebarWidth }
        : undefined}
    >
      <div className={styles.sidebarHeader}>
        {filters.isOpen ? (
          <>
            <div className={styles.sidebarHeading}>
              <h1 className={styles.sidebarTitle}>{t("stock.inventory")}</h1>
            </div>
            <button
              type="button"
              className={styles.sidebarIconButton}
              onClick={() => filters.setIsOpen(false)}
              title={t("stock.closeFilters")}
              aria-label={t("stock.closeFilters")}
            >
              <span
                className={`${styles.sidebarToggleGlyph} ${styles.sidebarToggleGlyphOpen}`}
                aria-hidden="true"
              />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.sidebarIconButton}
            onClick={() => filters.setIsOpen(true)}
            title={t("stock.openFilters")}
            aria-label={t("stock.openFilters")}
          >
            <span className={styles.sidebarToggleGlyph} aria-hidden="true" />
          </button>
        )}
      </div>

      {filters.isOpen && (
        <>
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
            <StockFilterDropdown
              id="stock-adjustment-options"
              label={t("stock.adjustment")}
              options={STOCK_ADJUSTMENT_STATES}
              selectedOptions={filters.draft.adjustmentStatuses}
              isOpen={filters.openPanel === "stockAdjustment"}
              onToggle={() => filters.togglePanel("stockAdjustment")}
              onToggleOption={(option) => filters.toggleOption("adjustmentStatuses", option)}
              searchable={false}
              helperText={t("stock.adjustmentFilterNote")}
              getOptionLabel={localizeFilterOption}
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
        </>
      )}

      {filters.isOpen && (
        <div
          className={styles.sidebarResizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("stock.resizeFilters")}
          onMouseDown={startResize}
        />
      )}
    </aside>
  );
}
