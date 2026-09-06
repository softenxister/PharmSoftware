import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Edit3,
  MoreVertical,
  PackagePlus,
  Plus,
  Search,
} from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { ProductImage } from "@/components/product/ProductImage";
import { localizeUnitExpression } from "@/i18n/productUnits";
import { isStockRowActivationKey } from "@/features/stock/stockRowInteraction";
import type {
  StockState,
  StockTableSortKey,
} from "./stockInventoryModel";
import { roundMarkupPercentForDisplay } from "./stockInventoryModel";
import type { StockInventoryController } from "./useStockInventory";
import styles from "@/features/stock/Stock.module.css";

export function StockInventoryTable({
  controller,
}: {
  controller: StockInventoryController;
}) {
  const { t, formatDate, formatNumber, preferences } = usePreferences();

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

  const sortHeader = (
    key: StockTableSortKey,
    label: string,
    alignment: "start" | "end" = "start",
  ) => (
    <button
      type="button"
      className={`${styles.headerCell} ${styles.sortButton} ${
        alignment === "end" ? styles.sortButtonEnd : ""
      }`}
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
        <span className={styles.toolbarSpacer} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.toolbarAddButton} ${styles.createActionButton}`}
          onClick={controller.productEntry.openCreate}
        >
          <Plus size={17} aria-hidden="true" />
          <span>{t("stock.createItem")}</span>
        </button>
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
                count: controller.inventoryCounts.lowStock,
              })}
            </span>
            <span>
              {t("stock.overCount", {
                count: controller.inventoryCounts.overstock,
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
                  {sortHeader("minimum", t("stock.minimumShort"), "end")}
                </th>
                <th aria-sort={ariaSort("maximum")}>
                  {sortHeader("maximum", t("stock.maximumShort"), "end")}
                </th>
                <th aria-sort={ariaSort("stock")}>
                  {sortHeader("stock", t("nav.stock"), "end")}
                </th>
                <th aria-sort={ariaSort("cost")}>
                  {sortHeader("cost", t("stock.cost"), "end")}
                </th>
                <th aria-sort={ariaSort("markup")}>
                  {sortHeader("markup", t("stock.markupShort"), "end")}
                </th>
                <th aria-sort={ariaSort("sellPrice")}>
                  {sortHeader("sellPrice", t("stock.sellPrice"), "end")}
                </th>
                <th aria-sort={ariaSort("createdAt")}>
                  {sortHeader("createdAt", t("stock.dateAdded"), "end")}
                </th>
                <th className={styles.actionCol} aria-label={t("stock.itemActions")} />
              </tr>
            </thead>
            <tbody>
              {controller.items.map((item, index) => (
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
                        <ProductImage
                          priority={index < 8}
                          src={item.imageUrl}
                          alt={t("stock.productImage", { name: item.name })}
                          width={52}
                          height={52}
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
                    <span className={styles.priceValue}>
                      ฿{formatNumber(item.cost, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.marginValue} ${
                      item.markupPercent !== undefined && item.markupPercent < 0
                        ? styles.marginValueNegative
                        : ""
                    }`}>
                      {item.markupPercent === undefined
                        ? "—"
                        : `${formatNumber(
                          roundMarkupPercentForDisplay(item.markupPercent),
                          { maximumFractionDigits: 0 },
                        )}%`}
                    </span>
                  </td>
                  <td>
                    <span className={styles.priceValue}>
                      ฿{formatNumber(item.sellPrice, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td>
                    {item.createdAt && (
                      <time className={styles.dateValue} dateTime={item.createdAt}>
                        {formatDate(item.createdAt, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    )}
                  </td>
                  <td>
                    <span className={styles.actionCell}>
                      <span className={styles.rowActionMenu}>
                        <button
                          type="button"
                          className={styles.actionMenuTrigger}
                          title={t("stock.itemActions")}
                          aria-label={`${t("stock.itemActions")}: ${item.name}`}
                          aria-haspopup="menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreVertical size={18} aria-hidden="true" />
                        </button>
                        <span className={styles.actionMenu} role="menu">
                          {controller.user?.role === "owner" && (
                            <button
                              type="button"
                              className={styles.actionMenuItem}
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                controller.adjustment.open(item.id);
                              }}
                            >
                              <PackagePlus size={15} aria-hidden="true" />
                              {t("stock.adjust")}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionMenuItem}
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              controller.itemDetail.open(item.id);
                            }}
                          >
                            <Edit3 size={15} aria-hidden="true" />
                            {t("stock.setItemDetail")}
                          </button>
                        </span>
                      </span>
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
