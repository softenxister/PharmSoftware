import { createHash } from "node:crypto";
import { parseCwStockCsvRows } from "./cwStockNormalizer";

const REQUIRED_HEADERS = ["รหัสสินค้า", "ชื่อสามัญ", "ราคาทุนรับหลังสุด"] as const;
const MAX_PRODUCT_CODE_LENGTH = 100;
const MAX_GENERIC_NAME_LENGTH = 2_000;
const MAX_COST_THB = 999_999_999_999.9999;

const DETAIL_UPDATE_STATUS_ORDER: Record<CwStockDetailUpdateStatus, number> = {
  invalid: 0,
  unmatched: 1,
  unchanged: 2,
  changed: 3,
};

export type CwStockDetailExistingProduct = {
  id: string;
  externalProductCode: string;
  itemName: string;
  migrationGenericName: string | null;
  migrationCostThb: number | null;
};

export type CwStockDetailSourceRow = {
  sourceRow: number;
  externalProductCode: string;
  migrationGenericName: string | null;
  migrationCostThb: number | null;
  issue: string | null;
};

export type CwStockDetailUpdateStatus = "changed" | "unchanged" | "unmatched" | "invalid";

export type CwStockDetailUpdateRow = CwStockDetailSourceRow & {
  status: CwStockDetailUpdateStatus;
  matchedProductId: string | null;
  matchedItemName: string | null;
  currentGenericName: string | null;
  currentCostThb: number | null;
  nextGenericName: string | null;
  nextCostThb: number | null;
};

export type CwStockDetailUpdatePreview = {
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
  rows: CwStockDetailUpdateRow[];
};

export type PreparedCwStockDetailUpdate = {
  preview: CwStockDetailUpdatePreview;
  importRows: CwStockDetailUpdateRow[];
};

function parseCost(value: string, sourceRow: number): { cost: number | null; issue: string | null } {
  const text = value.trim();
  if (!text) return { cost: null, issue: null };
  const normalized = text.replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) {
    return { cost: null, issue: `Row ${sourceRow}: ราคาทุนรับหลังสุด must be zero or a positive number with at most four decimals.` };
  }
  const cost = Number(normalized);
  if (cost === 0) return { cost: null, issue: null };
  if (!Number.isFinite(cost) || cost < 0 || cost > MAX_COST_THB) {
    return { cost: null, issue: `Row ${sourceRow}: ราคาทุนรับหลังสุด is outside the supported range.` };
  }
  return { cost, issue: null };
}

export function extractCwStockDetailRows(csvText: string): CwStockDetailSourceRow[] {
  const rows = parseCwStockCsvRows(csvText);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) throw new Error(`CSV is missing required columns: ${missing.join(", ")}`);
  const codeIndex = headers.indexOf("รหัสสินค้า");
  const genericIndex = headers.indexOf("ชื่อสามัญ");
  const costIndex = headers.indexOf("ราคาทุนรับหลังสุด");

  return rows.flatMap((row, index): CwStockDetailSourceRow[] => {
    if (!row.some((cell) => cell.trim())) return [];
    const externalProductCode = (row[codeIndex] ?? "").trim();
    if (!externalProductCode) return [];
    const genericName = (row[genericIndex] ?? "").trim();
    const sourceRow = index + 2;
    const parsedCost = parseCost(row[costIndex] ?? "", sourceRow);
    let issue = parsedCost.issue;
    if (externalProductCode.length > MAX_PRODUCT_CODE_LENGTH) {
      issue = `Row ${sourceRow}: รหัสสินค้า must be ${MAX_PRODUCT_CODE_LENGTH} characters or fewer.`;
    } else if (genericName.length > MAX_GENERIC_NAME_LENGTH) {
      issue = `Row ${sourceRow}: ชื่อสามัญ must be ${MAX_GENERIC_NAME_LENGTH} characters or fewer.`;
    }
    return [{
      sourceRow,
      externalProductCode,
      migrationGenericName: genericName || null,
      migrationCostThb: parsedCost.cost,
      issue,
    }];
  });
}

export function prepareCwStockDetailUpdate(
  csvText: string,
  existingProducts: readonly CwStockDetailExistingProduct[],
): PreparedCwStockDetailUpdate {
  const sourceRows = extractCwStockDetailRows(csvText);
  const codeCounts = new Map<string, number>();
  for (const row of sourceRows) {
    codeCounts.set(row.externalProductCode, (codeCounts.get(row.externalProductCode) ?? 0) + 1);
  }
  const existingByCode = new Map(existingProducts.map((product) => [product.externalProductCode, product]));
  const rows = sourceRows.map((source): CwStockDetailUpdateRow => {
    const duplicate = (codeCounts.get(source.externalProductCode) ?? 0) > 1;
    const issue = duplicate ? "Duplicate CW product code in the uploaded file." : source.issue;
    const matched = issue ? null : existingByCode.get(source.externalProductCode) ?? null;
    const currentGenericName = matched?.migrationGenericName ?? null;
    const currentCostThb = matched?.migrationCostThb ?? null;
    const nextGenericName = source.migrationGenericName ?? currentGenericName;
    const nextCostThb = source.migrationCostThb ?? currentCostThb;
    const changed = nextGenericName !== currentGenericName || nextCostThb !== currentCostThb;
    const status: CwStockDetailUpdateStatus = issue
      ? "invalid"
      : !matched
        ? "unmatched"
        : changed ? "changed" : "unchanged";
    return {
      ...source,
      issue: issue ?? (matched ? null : "No existing product has this exact CW product code."),
      status,
      matchedProductId: matched?.id ?? null,
      matchedItemName: matched?.itemName ?? null,
      currentGenericName,
      currentCostThb,
      nextGenericName,
      nextCostThb,
    };
  }).sort((left, right) => (
    DETAIL_UPDATE_STATUS_ORDER[left.status] - DETAIL_UPDATE_STATUS_ORDER[right.status]
    || left.sourceRow - right.sourceRow
  ));
  const reconciliation = rows.map((row) => ({
    sourceRow: row.sourceRow,
    externalProductCode: row.externalProductCode,
    status: row.status,
    matchedProductId: row.matchedProductId,
    nextGenericName: row.nextGenericName,
    nextCostThb: row.nextCostThb,
    issue: row.issue,
  }));
  const confirmationToken = createHash("sha256")
    .update("generic-cost-update", "utf8")
    .update("\0", "utf8")
    .update(csvText, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");
  const count = (status: CwStockDetailUpdateStatus) => rows.filter((row) => row.status === status).length;
  return {
    preview: {
      sourceSoftware: "CW",
      mode: "generic-cost-update",
      confirmationToken,
      summary: {
        totalRows: rows.length,
        changedCount: count("changed"),
        unchangedCount: count("unchanged"),
        unmatchedCount: count("unmatched"),
        invalidCount: count("invalid"),
      },
      rows,
    },
    importRows: rows.filter((row) => row.status === "changed"),
  };
}
