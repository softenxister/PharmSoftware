import { useEffect, useMemo, useState } from "react";
import type {
  SalesProduct,
  StockInventoryMetadata,
} from "@server/db/types";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  invalidateStockCatalog,
  loadStockPage,
} from "@/api/stockCatalogClient";
import { useProductEditorLifecycle } from "@/features/product/entry/useProductEditorLifecycle";
import {
  buildFilterOptions,
  DOSAGE_FORMS,
  createEmptyAppliedFilters,
  createEmptyDraftFilters,
  parseStockRange,
  projectAuthoritativeInventoryPage,
  projectStockInventoryItem,
  SIDEBAR_DEFAULT_WIDTH,
  STOCK_PAGE_SIZE,
  toggleSelectedOption,
  type MultiSelectFilterKey,
  type StockFilterPanel,
  type StockTableSort,
  type StockTableSortKey,
} from "./stockInventoryModel";

const EMPTY_INVENTORY_METADATA: StockInventoryMetadata = {
  facets: { legalCategories: [], dosageTypes: [], manufacturers: [], tags: [] },
  counts: { lowStock: 0, overstock: 0 },
};

export function useStockInventory() {
  const { user } = useAuth();
  const [isSidebarClosed, setIsSidebarClosed] = useState(false);
  const [openFilterPanel, setOpenFilterPanel] = useState<StockFilterPanel | null>(null);
  const [draftFilters, setDraftFilters] = useState(createEmptyDraftFilters);
  const [appliedFilters, setAppliedFilters] = useState(createEmptyAppliedFilters);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [sort, setSort] = useState<StockTableSort>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [inventoryMetadata, setInventoryMetadata] = useState<StockInventoryMetadata>(
    EMPTY_INVENTORY_METADATA,
  );
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [stockRefreshVersion, setStockRefreshVersion] = useState(0);
  const [adjustmentProduct, setAdjustmentProduct] = useState<SalesProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<SalesProduct | null>(null);
  const [adjustmentSuccess, setAdjustmentSuccess] = useState(false);
  const productEntry = useProductEditorLifecycle({
    inventory: { products, total: totalProducts },
    onReconcile: (inventory) => {
      setProducts(inventory.products);
      setTotalProducts(inventory.total);
    },
    onRefresh: () => setStockRefreshVersion((version) => version + 1),
  });

  useEffect(() => {
    setPage(1);
    const trimmed = query.trim();
    const timeout = window.setTimeout(() => setDebouncedQuery(trimmed), trimmed ? 180 : 0);
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
          sort: sort.key,
          sortDirection: sort.direction,
          filters: appliedFilters,
          includeInventoryMetadata: true,
        });
        if (cancelled) return;
        const authoritativePage = projectAuthoritativeInventoryPage(result);
        if (
          authoritativePage.products.length === 0
          && authoritativePage.total > 0
          && page > 1
        ) {
          setPage(Math.max(1, Math.ceil(authoritativePage.total / STOCK_PAGE_SIZE)));
          return;
        }
        setProducts(authoritativePage.products);
        setTotalProducts(authoritativePage.total);
        setHasMoreProducts(authoritativePage.hasMore);
        setInventoryMetadata(authoritativePage.inventory);
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
  }, [appliedFilters, debouncedQuery, page, sort, stockRefreshVersion]);

  useEffect(() => {
    if (!adjustmentSuccess) return;
    const timeout = window.setTimeout(() => setAdjustmentSuccess(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [adjustmentSuccess]);

  const items = useMemo(
    () => products.map(projectStockInventoryItem),
    [products],
  );
  const stockRangeResult = useMemo(
    () => parseStockRange(draftFilters.minimumStock, draftFilters.maximumStock),
    [draftFilters.maximumStock, draftFilters.minimumStock],
  );
  const dosageTypeOptions = useMemo(
    () => [...DOSAGE_FORMS],
    [],
  );
  const legalCategoryOptions = useMemo(
    () => buildFilterOptions(
      draftFilters.legalCategories,
      inventoryMetadata.facets.legalCategories,
    ),
    [draftFilters.legalCategories, inventoryMetadata.facets.legalCategories],
  );
  const manufacturerOptions = useMemo(
    () => buildFilterOptions(
      draftFilters.manufacturers,
      inventoryMetadata.facets.manufacturers,
    ),
    [draftFilters.manufacturers, inventoryMetadata.facets.manufacturers],
  );
  const tagOptions = useMemo(
    () => buildFilterOptions(
      draftFilters.tags,
      inventoryMetadata.facets.tags,
    ),
    [draftFilters.tags, inventoryMetadata.facets.tags],
  );

  const changeSort = (key: StockTableSortKey) => {
    setPage(1);
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleFilterPanel = (panel: StockFilterPanel) => {
    setOpenFilterPanel((current) => current === panel ? null : panel);
  };

  const toggleDraftFilterOption = (filter: MultiSelectFilterKey, option: string) => {
    setDraftFilters((current) => ({
      ...current,
      [filter]: toggleSelectedOption(current[filter], option),
    }));
  };

  const resetFilters = () => {
    setDraftFilters(createEmptyDraftFilters());
    setAppliedFilters(createEmptyAppliedFilters());
    setPage(1);
    setOpenFilterPanel(null);
  };

  const applyFilters = () => {
    if (!stockRangeResult.isValid) return;
    setPage(1);
    setAppliedFilters({
      categories: draftFilters.categories,
      legalCategories: draftFilters.legalCategories,
      dosageTypes: draftFilters.dosageTypes,
      expiryWindows: draftFilters.expiryWindows,
      stockLevels: draftFilters.stockLevels,
      regulatoryForms: draftFilters.regulatoryForms,
      missingValues: draftFilters.missingValues,
      manufacturers: draftFilters.manufacturers,
      tags: draftFilters.tags,
      stockRange: stockRangeResult.range,
    });
    setOpenFilterPanel(null);
  };

  const replaceVisibleProduct = (nextProduct: SalesProduct) => {
    setProducts((current) => {
      const exists = current.some(({ id }) => id === nextProduct.id);
      return exists
        ? current.map((product) => product.id === nextProduct.id ? nextProduct : product)
        : [nextProduct, ...current].slice(0, STOCK_PAGE_SIZE);
    });
  };

  const openAdjustmentByBarcode = (barcode: string) => {
    if (user?.role !== "owner") return;
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) setAdjustmentProduct(product);
  };

  const openDetailByBarcode = (barcode: string) => {
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) setDetailProduct(product);
  };

  const saveItemDetail = (product: SalesProduct) => {
    replaceVisibleProduct(product);
    invalidateStockCatalog();
    setStockRefreshVersion((version) => version + 1);
    setDetailProduct(null);
  };

  const saveAdjustment = (
    productId: string,
    quantities: Array<{ batchNo: string; expiryDate: string; availableStock: number }>,
  ) => {
    const quantityByBatch = new Map(quantities.map((quantity) => [
      `${quantity.batchNo}\0${quantity.expiryDate}`,
      quantity.availableStock,
    ]));
    setProducts((current) => current.map((product) => product.id !== productId ? product : ({
      ...product,
      batches: product.batches.map((batch) => {
        const nextQuantity = quantityByBatch.get(`${batch.batchNo}\0${batch.expiryDate}`);
        return nextQuantity === undefined ? batch : { ...batch, availableStock: nextQuantity };
      }),
    })));
    setAdjustmentProduct(null);
    setAdjustmentSuccess(true);
    invalidateStockCatalog();
    setStockRefreshVersion((version) => version + 1);
  };

  return {
    user,
    query,
    setQuery,
    items,
    products,
    totalProducts,
    inventoryCounts: inventoryMetadata.counts,
    hasMoreProducts,
    isLoadingProducts,
    page,
    pageCount: Math.max(1, Math.ceil(totalProducts / STOCK_PAGE_SIZE)),
    previousPage: () => setPage((current) => Math.max(1, current - 1)),
    nextPage: () => setPage((current) => current + 1),
    sort,
    changeSort,
    filters: {
      isSidebarClosed,
      setIsSidebarClosed,
      openPanel: openFilterPanel,
      closePanel: () => setOpenFilterPanel(null),
      togglePanel: toggleFilterPanel,
      draft: draftFilters,
      setRange: (field: "minimumStock" | "maximumStock", value: string) => {
        setDraftFilters((current) => ({ ...current, [field]: value }));
      },
      toggleOption: toggleDraftFilterOption,
      reset: resetFilters,
      apply: applyFilters,
      range: stockRangeResult,
      legalCategoryOptions,
      dosageTypeOptions,
      manufacturerOptions,
      tagOptions,
      sidebarWidth,
      setSidebarWidth,
    },
    productEntry,
    adjustment: {
      product: adjustmentProduct,
      open: openAdjustmentByBarcode,
      close: () => setAdjustmentProduct(null),
      save: saveAdjustment,
      success: adjustmentSuccess,
    },
    itemDetail: {
      product: detailProduct,
      open: openDetailByBarcode,
      close: () => setDetailProduct(null),
      save: saveItemDetail,
    },
  };
}

export type StockInventoryController = ReturnType<typeof useStockInventory>;
