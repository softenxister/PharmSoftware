"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Edit3,
  MapPin,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  readSeedStockProducts,
  type SalesProduct,
  type StockItemInput,
} from "@/server/db/database";
import { StockEntryForm } from "./StockEntryForm";
import styles from "./Stock.module.css";

type StockState = "normal" | "low" | "overstock";

interface StockItem {
  id: string;
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  pack: string;
  min: number;
  max: number;
  stock: number;
  loc: string;
  discount: number;
  sellPrice: number;
  margin: number;
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
    pack: product.pack.label,
    min,
    max,
    stock,
    loc: product.location,
    discount: index % 4 === 0 ? 2 : index % 5 === 0 ? 1.5 : 0,
    sellPrice,
    margin: Math.max(16, Math.min(42, Math.round(28 + product.weeklySold / 35))),
    imageUrl: product.imageUrl,
    state,
  };
}

const filterGroups = [
  "Items",
  "Category",
  "Dosage Type",
  "Schedule Type",
  "Expiry",
  "Stock",
  "Stock Range",
  "Manufacturer",
];

const stockAdjustmentStates = ["Pending", "Completed", "Blocked"];
const LEGACY_STOCK_DATABASE_KEY = "pharm_stock_items";

function formatMoney(value: number): string {
  return `฿${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function StockPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [stockWindowOpen, setStockWindowOpen] = useState(false);
  const [products, setProducts] = useState<SalesProduct[]>(() => readSeedStockProducts());

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch("/api/stock", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load stock database.");
        const data = await response.json() as { products?: SalesProduct[] };
        if (!cancelled && Array.isArray(data.products)) setProducts(data.products);

        const legacyRaw = window.localStorage.getItem(LEGACY_STOCK_DATABASE_KEY);
        if (!legacyRaw) return;

        const legacyItems = JSON.parse(legacyRaw);
        if (!Array.isArray(legacyItems) || legacyItems.length === 0) {
          window.localStorage.removeItem(LEGACY_STOCK_DATABASE_KEY);
          return;
        }

        const migrateResponse = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: legacyItems }),
        });
        if (!migrateResponse.ok) throw new Error("Unable to migrate browser stock.");
        const migratedData = await migrateResponse.json() as { products?: SalesProduct[] };
        if (!cancelled && Array.isArray(migratedData.products)) setProducts(migratedData.products);
        window.localStorage.removeItem(LEGACY_STOCK_DATABASE_KEY);
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
    const q = query.trim().toLowerCase();
    if (!q) return stockItems;

    return stockItems.filter((item) =>
      [item.name, item.brand, item.manufacturer, item.category, item.pack, item.loc, item.id].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [query, stockItems]);

  const openAddStock = () => setStockWindowOpen(true);
  const closeAddStock = () => setStockWindowOpen(false);
  const handleSaveStock = async (item: StockItemInput) => {
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error("Unable to save stock item.");
      const data = await response.json() as { products?: SalesProduct[] };
      if (Array.isArray(data.products)) setProducts(data.products);
      closeAddStock();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={styles.page}>
      <aside
        className={`${styles.sidebar} ${!isFilterOpen ? styles.sidebarClosed : ""}`}
        aria-label="Stock filters"
      >
        <div className={styles.sidebarHeader}>
          {isFilterOpen ? (
            <>
              <div>
                <p className={styles.sidebarEyebrow}>Inventory</p>
                <h1 className={styles.sidebarTitle}>Stock</h1>
              </div>
              <button
                type="button"
                className={styles.sidebarIconButton}
                onClick={() => setIsFilterOpen(false)}
                title="Close filter bar"
                aria-label="Close filter bar"
              >
                <PanelLeftClose size={18} />
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
              <PanelLeftOpen size={18} />
            </button>
          )}
        </div>

        {isFilterOpen && (
          <>
            <button type="button" className={styles.addStockButton} onClick={openAddStock}>
              <Plus size={17} />
              <span>Add Stock</span>
            </button>

            <div className={styles.filterList}>
              {filterGroups.map((group) => (
                <button type="button" className={styles.filterButton} key={group}>
                  <span className={styles.filterText}>
                    <span className={styles.filterLabel}>{group}</span>
                  </span>
                  <ChevronDown size={16} />
                </button>
              ))}
            </div>

            <section className={styles.adjustmentBox} aria-label="Stock adjustment status">
              <button type="button" className={styles.adjustmentHeader}>
                <span>Stock Adjustment</span>
                <ChevronDown size={16} />
              </button>
              <div className={styles.checkboxList}>
                {stockAdjustmentStates.map((status) => (
                  <label key={status} className={styles.checkboxRow}>
                    <input type="checkbox" />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className={styles.sidebarActions}>
              <button type="button" className={styles.resetButton}>
                Reset
              </button>
              <button type="button" className={styles.applyButton}>
                Apply Filter
              </button>
            </div>
          </>
        )}
      </aside>

      <section className={styles.content}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setIsFilterOpen((value) => !value)}
            title={isFilterOpen ? "Close filter bar" : "Open filter bar"}
            aria-label={isFilterOpen ? "Close filter bar" : "Open filter bar"}
            aria-pressed={isFilterOpen}
          >
            {isFilterOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>

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
            <span>Add Stock</span>
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
                  <th>Margin%</th>
                  <th className={styles.actionCol}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={styles.itemCell}>
                        <span className={`${styles.stockDot} ${styles[`stockDot_${item.state}`]}`} />
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
                      <span className={styles.stockValue}>{item.stock}</span>
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
                      <span className={styles.marginValue}>{formatPercent(item.margin)}</span>
                    </td>
                    <td>
                      <span className={styles.actionCell}>
                        <button type="button" className={styles.actionButton} title="Adjust stock" aria-label={`Adjust stock for ${item.name}`}>
                          <PackagePlus size={17} />
                        </button>
                        <button type="button" className={styles.actionButton} title="Edit item detail" aria-label={`Edit item detail for ${item.name}`}>
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
        <div className={styles.stockWindowBackdrop} role="presentation">
          <section className={styles.stockEntryWindow} role="dialog" aria-modal="true" aria-label="Add stock">
            <button
              type="button"
              className={styles.stockWindowClose}
              onClick={closeAddStock}
              aria-label="Close add stock window"
              title="Close"
            >
              x
            </button>
            <StockEntryForm onClose={closeAddStock} onSave={handleSaveStock} />
          </section>
        </div>
      )}
    </div>
  );
}
