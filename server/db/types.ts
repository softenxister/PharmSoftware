export type Customer = {
  id: string;
  name: string;
  mobile: string;
  avatarUrl?: string;
  isMember: boolean;
  frequentProductIds: string[];
  allergies?: IngredientSummary[];
};

export type IngredientSummary = {
  id: string;
  canonicalName: string;
  thaiName?: string;
};

export type ProductCompositionStatus = "pending" | "verified" | "unavailable" | "not_applicable";

export type ProductIngredient = IngredientSummary & {
  strength?: string;
  sourceName: string;
  sourceUrl: string;
};

export type ProductBatch = {
  batchNo: string;
  expiryDate: string;
  sellPriceThb: number;
  costThb?: number;
  availableStock: number;
};

export type ProductPack = {
  packUnit: string;
  childUnit: string;
  childQuantity: number;
  label: string;
};

export type ParentPack = {
  id?: string;
  packUnit: string;
  childPackUnit: string;
  childPackQuantity: number;
  label: string;
  priceMultiplier: number;
  sellPriceThb?: number;
  barcodes?: string[];
};

export type SalesProduct = {
  id: string;
  externalProductCode?: string;
  itemName: string;
  brandName: string;
  manufacturerName: string;
  pack: ProductPack;
  parentPacks: ParentPack[];
  location: string;
  minimumStock?: number;
  maximumStock?: number;
  discountPercent?: number;
  isDiscountLocked?: boolean;
  isReturnable?: boolean;
  defaultDosage?: [number, number, number, number];
  tagName?: string;
  barcode: string;
  barcodes?: string[];
  category: string;
  imageUrl: string;
  weeklySold: number;
  averageCostThb?: number;
  genericName?: string;
  legalCategory?: string;
  compositionStatus?: ProductCompositionStatus;
  activeIngredients?: ProductIngredient[];
  batches: ProductBatch[];
};

export type StockInventoryMetadata = {
  facets: {
    dosageTypes: string[];
    manufacturers: string[];
    tags: string[];
  };
  counts: {
    lowStock: number;
    overstock: number;
  };
};

export type StockProductPage = {
  products: SalesProduct[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  inventory?: StockInventoryMetadata;
};

export type StockPackagingInput = {
  parentUnit: string;
  childQuantity: string;
  childUnit: string;
  barcode: string;
  barcodes?: string[];
  sellPrice?: string;
};

export type StockItemInput = {
  productId?: string;
  photoUrl: string;
  barcode: string;
  barcodes?: string[];
  itemName: string;
  lotNo: string;
  expiryDate: string;
  location: string;
  manufacturer: string;
  sellPrice: string;
  itemCategory: string;
  weightage: string;
  subUnit?: string;
  unit: string;
  brandName: string;
  genericName?: string;
  legalCategory?: string;
  packagingRows: StockPackagingInput[];
};

export type SavedStockItem = StockItemInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
