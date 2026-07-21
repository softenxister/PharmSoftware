export type MigrationRow = {
  externalProductCode: string;
  itemName: string;
  brandName: string | null;
  brandConfidence: "high" | "medium" | "review";
  brandMatchedAlias: string | null;
  baseUnit: string;
  baseBarcode: string;
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
  migrationId: string;
  createdCount: number;
  updatedCount: number;
  skippedConflictCount: number;
  stockReplacedCount: number;
};

type ApiError = { error?: { message?: string } };

export async function submitCwMigration<T>(
  action: "preview" | "import",
  file: File,
  confirmationToken?: string,
): Promise<T> {
  const body = new FormData();
  body.set("action", action);
  body.set("file", file);
  if (confirmationToken) body.set("confirmationToken", confirmationToken);

  const response = await fetch("/api/stock/migrations/cw", { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as ApiError & { data?: T };
  if (!response.ok) throw new Error(payload.error?.message ?? "The CW migration request failed.");
  if (!payload.data) throw new Error("The CW migration response was incomplete.");
  return payload.data;
}
