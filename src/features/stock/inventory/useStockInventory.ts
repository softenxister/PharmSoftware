import { useEffect, useMemo, useState } from "react";
import type { SalesProduct, StockItemInput } from "@server/db/types";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  invalidateStockCatalog,
  loadStockPage,
  saveStockProduct,
  saveStockProductPhotoUrl,
} from "@/api/stockCatalogClient";
import { isStockPhotoUrlOnlyChange } from "@/lib/stockPhotoUrlChange";
import {
  buildFilterOptions,
  COMMON_DOSAGE_TYPES,
  createEmptyAppliedFilters,
  createEmptyDraftFilters,
  parseStockRange,
  productToStockItemInput,
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

export function useStockInventory() {
  const { user } = useAuth();
  const [isFilterOpen, setIsFilterOpen] = useState(true);
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
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [stockRefreshVersion, setStockRefreshVersion] = useState(0);
  const [stockWindowOpen, setStockWindowOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SalesProduct | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<SalesProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<SalesProduct | null>(null);
  const [adjustmentSuccess, setAdjustmentSuccess] = useState(false);

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
    () => buildFilterOptions(
      COMMON_DOSAGE_TYPES,
      [
        ...draftFilters.dosageTypes,
        ...products.map((product) => product.pack.childUnit),
      ],
    ),
    [draftFilters.dosageTypes, products],
  );
  const manufacturerOptions = useMemo(
    () => buildFilterOptions(
      draftFilters.manufacturers,
      products.map((product) => product.manufacturerName),
    ),
    [draftFilters.manufacturers, products],
  );
  const tagOptions = useMemo(
    () => buildFilterOptions(
      draftFilters.tags,
      products.map((product) => product.tagName ?? ""),
    ),
    [draftFilters.tags, products],
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
      dosageTypes: draftFilters.dosageTypes,
      expiryWindows: draftFilters.expiryWindows,
      stockLevels: draftFilters.stockLevels,
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

  const openCreateProduct = () => {
    setEditingProduct(null);
    setStockWindowOpen(true);
  };

  const openProductByBarcode = (barcode: string) => {
    const product = products.find((candidate) => candidate.barcode === barcode);
    if (product) {
      setEditingProduct(product);
      setStockWindowOpen(true);
    }
  };

  const closeProductEntry = () => {
    setStockWindowOpen(false);
    setEditingProduct(null);
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

  const saveProduct = async (item: StockItemInput) => {
    if (editingProduct && isStockPhotoUrlOnlyChange(
      productToStockItemInput(editingProduct),
      item,
    )) {
      const result = await saveStockProductPhotoUrl(editingProduct.id, item.photoUrl);
      replaceVisibleProduct({ ...editingProduct, imageUrl: result.imageUrl });
      invalidateStockCatalog();
      closeProductEntry();
      return;
    }
    const product = await saveStockProduct(item);
    replaceVisibleProduct(product);
    invalidateStockCatalog();
    setStockRefreshVersion((version) => version + 1);
    closeProductEntry();
  };

  const deleteProduct = async () => {
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
    setProducts((current) => current.filter(({ id }) => id !== data.deletedProductId));
    setTotalProducts((total) => Math.max(0, total - 1));
    invalidateStockCatalog();
    setStockRefreshVersion((version) => version + 1);
    closeProductEntry();
  };

  const saveItemDetail = (product: SalesProduct) => {
    replaceVisibleProduct(product);
    invalidateStockCatalog();
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
  };

  return {
    user,
    query,
    setQuery,
    items,
    products,
    totalProducts,
    hasMoreProducts,
    isLoadingProducts,
    page,
    pageCount: Math.max(1, Math.ceil(totalProducts / STOCK_PAGE_SIZE)),
    previousPage: () => setPage((current) => Math.max(1, current - 1)),
    nextPage: () => setPage((current) => current + 1),
    sort,
    changeSort,
    filters: {
      isOpen: isFilterOpen,
      setIsOpen: setIsFilterOpen,
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
      dosageTypeOptions,
      manufacturerOptions,
      tagOptions,
      sidebarWidth,
      setSidebarWidth,
    },
    productEntry: {
      isOpen: stockWindowOpen,
      product: editingProduct,
      openCreate: openCreateProduct,
      openEdit: openProductByBarcode,
      close: closeProductEntry,
      save: saveProduct,
      delete: deleteProduct,
    },
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
