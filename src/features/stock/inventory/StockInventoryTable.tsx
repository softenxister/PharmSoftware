import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Edit3,
  MapPin,
  PackagePlus,
  Search,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { localizeUnitExpression } from "@/i18n/productUnits";
import { isStockRowActivationKey } from "@/features/stock/stockRowInteraction";
import type {
  StockState,
  StockTableSortKey,
} from "./stockInventoryModel";
import type { StockInventoryController } from "./useStockInventory";
import styles from "@/features/stock/Stock.module.css";

export function StockInventoryTable({
  controller,
}: {
  controller: StockInventoryController;
}) {
  const { t, formatNumber, preferences } = usePreferences();

  const stateLabel = (state: StockState) => {
    if (state === "low") return t("stock.belowMinimum");
    if (state === "overstock") return t("stock.aboveMaximum");
    return t("stock.withinRange");
  };

  const sortIcon = (key: StockTableSortKey) => {
    if (controller.sort.key !== key) return <ChevronsUpDown size={14} aria-hidden="true" />;
    return controller.sort.direction === "asc"
      ? <ArrowUp size={14} aria-hidden="true" />
      : <ArrowDown size={14} aria-hidden="true" />;
  };

  const sortHeader = (key: StockTableSortKey, label: string) => (
    <button
      type="button"
      className={`${styles.headerCell} ${styles.sortButton}`}
      onClick={() => controller.changeSort(key)}
      aria-label={t("member.sortBy", { label })}
    >
      <span>{label}</span>
      {sortIcon(key)}
    </button>
  );

  const ariaSort = (key: StockTableSortKey) => controller.sort.key === key
    ? controller.sort.direction === "asc" ? "ascending" : "descending"
    : "none";

  return (
    <section className={styles.content}>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <Search size={17} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={controller.query}
            onChange={(event) => controller.setQuery(event.target.value)}
            placeholder={t("stock.search")}
          />
        </label>
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          <div>
            <h2>{t("stock.items")}</h2>
            <p>{t("stock.found", { count: controller.totalProducts })}</p>
          </div>
          <div className={styles.tableSummary}>
            <span>
              {t("stock.lowCount", {
                count: controller.items.filter(({ state }) => state === "low").length,
              })}
            </span>
            <span>
              {t("stock.overCount", {
                count: controller.items.filter(({ state }) => state === "overstock").length,
              })}
            </span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.itemCol} aria-sort={ariaSort("name")}>
                  {sortHeader("name", t("stock.itemName"))}
                </th>
                <th aria-sort={ariaSort("minimum")}>
                  {sortHeader("minimum", t("stock.minimumShort"))}
                </th>
                <th aria-sort={ariaSort("maximum")}>
                  {sortHeader("maximum", t("stock.maximumShort"))}
                </th>
                <th aria-sort={ariaSort("stock")}>
                  {sortHeader("stock", t("nav.stock"))}
                </th>
                <th>{t("stock.locationShort")}</th>
                <th>{t("stock.marginShort")}</th>
                <th aria-sort={ariaSort("sellPrice")}>
                  {sortHeader("sellPrice", t("stock.sellPrice"))}
                </th>
                <th className={styles.actionCol} aria-label={t("stock.itemActions")} />
              </tr>
            </thead>
            <tbody>
              {controller.items.map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  aria-label={t("stock.editItemFor", { name: item.name })}
                  onClick={() => controller.productEntry.openEdit(item.id)}
                  onKeyDown={(event) => {
                    if (
                      event.target !== event.currentTarget
                      || !isStockRowActivationKey(event.key)
                    ) return;
                    event.preventDefault();
                    controller.productEntry.openEdit(item.id);
                  }}
                >
                  <td>
                    <span className={styles.itemCell}>
                      <span className={styles.productImageFrame}>
                        <img
                          src={item.imageUrl}
                          alt={t("stock.productImage", { name: item.name })}
                          className={styles.productImage}
                        />
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
                      title={stateLabel(item.state)}
                      aria-label={t("stock.unitsState", {
                        count: item.stock,
                        state: stateLabel(item.state),
                      })}
                    >
                      {item.stock}
                    </span>
                  </td>
                  <td>
                    <span className={styles.locationValue} title={item.loc}>
                      <MapPin size={13} aria-hidden="true" />
                      {item.loc}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.marginValue} ${
                      item.marginPercent !== undefined && item.marginPercent < 0
                        ? styles.marginValueNegative
                        : ""
                    }`}>
                      {item.marginPercent === undefined
                        ? "—"
                        : `${formatNumber(item.marginPercent, { maximumFractionDigits: 2 })}%`}
                    </span>
                  </td>
                  <td>
                    <span className={styles.priceValue}>
                      ฿{formatNumber(item.sellPrice, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td>
                    <span className={styles.actionCell}>
                      {controller.user?.role === "owner" && (
                        <button
                          type="button"
                          className={styles.actionButton}
                          title={t("stock.adjust")}
                          aria-label={t("stock.adjustFor", { name: item.name })}
                          onClick={(event) => {
                            event.stopPropagation();
                            controller.adjustment.open(item.id);
                          }}
                        >
                          <PackagePlus size={17} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.actionButton}
                        title={t("stock.setItemDetail")}
                        aria-label={t("stock.setItemDetailFor", { name: item.name })}
                        onClick={(event) => {
                          event.stopPropagation();
                          controller.itemDetail.open(item.id);
                        }}
                      >
                        <Edit3 size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {controller.items.length === 0 && !controller.isLoadingProducts && (
            <div className={styles.emptyState}>
              <strong>{t("stock.none")}</strong>
              <span>{t("stock.noneHint")}</span>
            </div>
          )}
        </div>

        <div className={styles.pagination} aria-label={t("stock.pages")}>
          <span>
            {controller.isLoadingProducts
              ? t("common.loading")
              : t("stock.pageOf", { page: controller.page, pages: controller.pageCount })}
          </span>
          <div className={styles.paginationButtons}>
            <button
              type="button"
              onClick={controller.previousPage}
              disabled={controller.page === 1 || controller.isLoadingProducts}
              aria-label={t("stock.previousPage")}
            >
              {t("common.previous")}
            </button>
            <button
              type="button"
              onClick={controller.nextPage}
              disabled={!controller.hasMoreProducts || controller.isLoadingProducts}
              aria-label={t("stock.nextPage")}
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
