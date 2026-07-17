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
  packUnit: string;
  childPackUnit: string;
  childPackQuantity: number;
  label: string;
  priceMultiplier: number;
};

export type SalesProduct = {
  id: string;
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
  category: string;
  imageUrl: string;
  weeklySold: number;
  compositionStatus?: ProductCompositionStatus;
  activeIngredients?: ProductIngredient[];
  batches: ProductBatch[];
};

export type RecentSale = {
  id: string;
  billNo: string;
  billDate: string;
  customerName: string;
  pharmacistName: string;
  paymentMethod: string;
  totalQuantity: number;
  uniqueItems: number;
  netPayableThb: number;
  status: "Paid" | "Draft" | "Voided";
};

export type StockPackagingInput = {
  parentUnit: string;
  childQuantity: string;
  childUnit: string;
  barcode: string;
};

export type StockItemInput = {
  photoUrl: string;
  barcode: string;
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
  packagingRows: StockPackagingInput[];
};

export type SavedStockItem = StockItemInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
