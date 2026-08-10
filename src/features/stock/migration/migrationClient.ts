export type MigrationRow = {
  externalProductCode: string;
  itemName: string;
  brandName: string | null;
  brandConfidence: "high" | "medium" | "review";
  brandMatchedAlias: string | null;
  baseUnit: string;
  baseBarcode: string;
  genericName: string;
  lastCostThb: number;
  availableStock: number;
  baseSellPriceThb: number;
  unitCount: number;
  units: Array<{
    unitName: string;
    quantityInBaseUnit: number;
    isBaseUnit: boolean;
    barcodes: string[];
    sellPriceThb: number;
  }>;
  status: "new" | "update" | "conflict";
  matchReason: "externalProductCode" | "barcode" | null;
  matchedProductId: string | null;
  matchedItemName: string | null;
  issue: string | null;
};

export type MigrationPreview = {
  sourceSoftware: "CW";
  mode: "full";
  confirmationToken: string;
  summary: {
    totalRows: number;
    totalUnits: number;
    newCount: number;
    updateCount: number;
    conflictCount: number;
    brandReviewCount: number;
  };
  rows: MigrationRow[];
};

export type MigrationResult = {
  mode: "full";
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  stockReplacedCount: number;
};

export type StockDetailUpdateRow = {
  sourceRow: number;
  externalProductCode: string;
  migrationGenericName: string | null;
  migrationCostThb: number | null;
  legalCategory: string | null;
  status: "changed" | "unchanged" | "unmatched" | "invalid";
  matchedProductId: string | null;
  matchedItemName: string | null;
  currentGenericName: string | null;
  currentCostThb: number | null;
  currentLegalCategory: string | null;
  nextGenericName: string | null;
  nextCostThb: number | null;
  nextLegalCategory: string | null;
  issue: string | null;
};

export type StockDetailUpdatePreview = {
  sourceSoftware: "CW";
  mode: "generic-cost-update";
  confirmationToken: string;
  summary: {
    totalRows: number;
    changedCount: number;
    unchangedCount: number;
    unmatchedCount: number;
    invalidCount: number;
  };
  rows: StockDetailUpdateRow[];
};

export type StockDetailUpdateResult = {
  mode: "generic-cost-update";
  migrationId: string;
  updatedCount: number;
  unchangedCount: number;
  unmatchedCount: number;
  invalidCount: number;
};

export type CwMigrationMode = "full" | "generic-cost-update";
export type CwMigrationPreview = MigrationPreview | StockDetailUpdatePreview;
export type CwMigrationResult = MigrationResult | StockDetailUpdateResult;

export type LotExpiryMigrationBatch = {
  lotNo: string;
  expiryDate: string;
  amount: number;
  unit: string;
  generatedLotNo: boolean;
  sourceRows: number[];
};

export type LotExpiryMigrationRow = {
  sourceRow: number;
  sequence: number;
  externalProductCode: string;
  itemName: string;
  reportedAmount: number;
  unit: string;
  remainderAmount: number;
  batches: LotExpiryMigrationBatch[];
  status: "matched" | "unmatched" | "conflict";
  matchedProductId: string | null;
  matchedItemName: string | null;
  sellPriceThb: number | null;
  issue: string | null;
};

export type LotExpiryMigrationPreview = {
  sourceSoftware: "CW";
  confirmationToken: string;
  summary: {
    totalProducts: number;
    matchedProducts: number;
    unmatchedProducts: number;
    conflictProducts: number;
    totalBatches: number;
    generatedLotCount: number;
    remainderProducts: number;
  };
  rows: LotExpiryMigrationRow[];
};

export type LotExpiryMigrationResult = {
  migrationId: string;
  replacedProductCount: number;
  createdBatchCount: number;
  skippedUnmatchedCount: number;
  skippedConflictCount: number;
};

export type MemberMigrationRow = {
  rowNumber: number;
  memberCode: string;
  name: string;
  address: string | null;
  rawPhone: string;
  phoneStatus: "valid" | "empty" | "invalid";
  rawMembershipStartedAt: string;
  status: "new" | "update" | "conflict";
  matchedCustomerId: string | null;
  issue: string | null;
  warning: string | null;
};

export type MemberMigrationPreview = {
  sourceSoftware: "CW";
  confirmationToken: string;
  summary: {
    totalRows: number;
    newCount: number;
    updateCount: number;
    conflictCount: number;
    phoneNullCount: number;
  };
  rows: MemberMigrationRow[];
};

export type MemberMigrationResult = {
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  importedCount: number;
};

export type CustomerPurchaseHistoryMigrationRow = {
  customerRowNumber: number;
  rowNumber: number;
  customerCode: string;
  customerName: string;
  externalProductCode: string;
  sourceItemName: string;
  unit: string;
  quantity: number;
  totalAmount: number;
  status: "matched" | "duplicate" | "unmatched_customer" | "unmatched_product" | "conflict";
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedProductId: string | null;
  matchedItemName: string | null;
  issue: string | null;
};

export type CustomerPurchaseHistoryMigrationPreview = {
  sourceSoftware: "CW";
  sourceFileHash: string;
  confirmationToken: string;
  reportPeriod: { startedAt: string | null; endedAt: string | null };
  summary: {
    totalRows: number;
    matchedCount: number;
    duplicateCount: number;
    unmatchedCustomerCount: number;
    unmatchedProductCount: number;
    conflictCount: number;
  };
  rows: CustomerPurchaseHistoryMigrationRow[];
};

export type CustomerPurchaseHistoryMigrationResult = {
  migrationId: string;
  importedCount: number;
  skippedDuplicateCount: number;
  skippedUnmatchedCustomerCount: number;
  skippedUnmatchedProductCount: number;
  skippedConflictCount: number;
};

export type DistributorMigrationRow = {
  rowNumber: number;
  code: string;
  name: string;
  status: "new" | "update" | "conflict";
  matchReason: "code" | "name" | null;
  matchedDistributorId: string | null;
  matchedDistributorName: string | null;
  issue: string | null;
};

export type DistributorMigrationPreview = {
  sourceSoftware: "CW";
  confirmationToken: string;
  summary: {
    totalRows: number;
    newCount: number;
    updateCount: number;
    conflictCount: number;
  };
  rows: DistributorMigrationRow[];
};

export type DistributorMigrationResult = {
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  importedCount: number;
};

type NormalizationResult = {
  evaluatedCount: number;
  changedCount: number;
  unchangedCount: number;
};

export type ProductCategoryNormalizationResult = NormalizationResult;
export type ProductMeasurementNormalizationResult = NormalizationResult;

type ApiError = { error?: { message?: string } };

function isNormalizationResult(value: unknown): value is NormalizationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<NormalizationResult>;
  return Number.isInteger(result.evaluatedCount)
    && Number.isInteger(result.changedCount)
    && Number.isInteger(result.unchangedCount)
    && Number(result.evaluatedCount) >= 0
    && Number(result.changedCount) >= 0
    && Number(result.unchangedCount) >= 0
    && Number(result.changedCount) + Number(result.unchangedCount) === Number(result.evaluatedCount);
}

export async function submitProductCategoryNormalization(
  fetcher: typeof fetch = fetch,
): Promise<ProductCategoryNormalizationResult> {
  const response = await fetcher("/api/stock/migrations/categories", { method: "POST" });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: unknown };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The product category normalization request failed.");
  }
  if (!isNormalizationResult(payload.data)) {
    throw new Error("The product category normalization response was incomplete.");
  }
  return payload.data;
}

export async function submitProductMeasurementNormalization(
  fetcher: typeof fetch = fetch,
): Promise<ProductMeasurementNormalizationResult> {
  const response = await fetcher("/api/stock/migrations/measurements", { method: "POST" });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: unknown };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The product measurement normalization request failed.");
  }
  if (!isNormalizationResult(payload.data)) {
    throw new Error("The product measurement normalization response was incomplete.");
  }
  return payload.data;
}

export async function submitCwMigration<T>(
  action: "preview" | "import",
  mode: CwMigrationMode,
  file: File,
  confirmationToken?: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("mode", mode);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  const response = await fetcher("/api/stock/migrations/cw", { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) throw new Error(payload.error?.message ?? "The CW migration request failed.");
  if (!payload.data) throw new Error("The CW migration response was incomplete.");
  return payload.data;
}

export async function submitLotExpiryMigration<T>(
  action: "preview" | "import",
  file: File,
  confirmationToken?: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  let response: Response;
  try {
    response = await fetcher("/api/stock/migrations/lots", {
      method: "POST",
      body,
    });
  } catch (error) {
    throw new Error(
      "The API server is unavailable. Start the Pharm API service and try again.",
      { cause: error },
    );
  }
  if ([502, 503, 504].includes(response.status)) {
    throw new Error("The API server is unavailable. Start the Pharm API service and try again.");
  }
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The lot and expiry migration request failed.");
  }
  if (!payload.data) throw new Error("The lot and expiry migration response was incomplete.");
  return payload.data;
}

export async function submitMemberDataMigration<T>(
  action: "preview" | "import",
  file: File,
  confirmationToken?: string,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  const response = await fetch("/api/stock/migrations/members", { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) throw new Error(payload.error?.message ?? "The member migration request failed.");
  if (!payload.data) throw new Error("The member migration response was incomplete.");
  return payload.data;
}

export async function submitCustomerPurchaseHistoryMigration<T>(
  action: "preview" | "import",
  file: File,
  confirmationToken?: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  let response: Response;
  try {
    response = await fetcher("/api/stock/migrations/customer-purchases", { method: "POST", body });
  } catch (error) {
    throw new Error(
      "The API server is unavailable. Start the Pharm API service and try again.",
      { cause: error },
    );
  }
  if ([502, 503, 504].includes(response.status)) {
    throw new Error("The API server is unavailable. Start the Pharm API service and try again.");
  }
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The customer purchase-history migration request failed.");
  }
  if (!payload.data) throw new Error("The customer purchase-history migration response was incomplete.");
  return payload.data;
}

export async function submitDistributorDataMigration<T>(
  action: "preview" | "import",
  file: File,
  confirmationToken?: string,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  const response = await fetch("/api/stock/migrations/distributors", { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) throw new Error(payload.error?.message ?? "The distributor migration request failed.");
  if (!payload.data) throw new Error("The distributor migration response was incomplete.");
  return payload.data;
}
