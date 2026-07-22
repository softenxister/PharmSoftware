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
