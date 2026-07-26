import { createHash } from "node:crypto";
import { canonicalizeProductUnit } from "@/i18n/productUnits";
import { readFirstXlsxWorksheet } from "./xlsxWorksheet";

export type SpreadsheetRow = {
  rowNumber: number;
  values: Map<string, string>;
};

export type NormalizedLotExpiryBatch = {
  lotNo: string;
  expiryDate: string;
  amount: number;
  unit: string;
  generatedLotNo: boolean;
  sourceRows: number[];
};

export type NormalizedLotExpiryItem = {
  sourceRow: number;
  sequence: number;
  externalProductCode: string;
  itemName: string;
  reportedAmount: number;
  unit: string;
  remainderAmount: number;
  batches: NormalizedLotExpiryBatch[];
};

export type ExistingLotExpiryProduct = {
  id: string;
  externalProductCode: string | null;
  itemName: string;
  baseUnit: string;
  sellPriceThb: number;
};

export type LotExpiryMigrationStatus = "matched" | "unmatched" | "conflict";

export type LotExpiryMigrationRow = NormalizedLotExpiryItem & {
  status: LotExpiryMigrationStatus;
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

export type PreparedLotExpiryMigration = {
  preview: LotExpiryMigrationPreview;
  importRows: LotExpiryMigrationRow[];
};

const PREVIEW_STATUS_PRIORITY: Record<LotExpiryMigrationStatus, number> = {
  unmatched: 0,
  conflict: 1,
  matched: 2,
};

type PendingItem = {
  sourceRow: number;
  sequence: number;
  values: Map<string, string>;
  detailRows: SpreadsheetRow[];
};

type SourceBatch = NormalizedLotExpiryBatch & {
  listedIndex: number;
};

function cell(values: ReadonlyMap<string, string>, column: string): string {
  return values.get(column)?.trim() ?? "";
}

function rawCell(values: ReadonlyMap<string, string>, column: string): string {
  return values.get(column) ?? "";
}

function amountCell(values: ReadonlyMap<string, string>): string {
  // CW displays this value across the merged K:M range. Some exporters anchor
  // the stored XML value in K while equivalent CSV/test data may expose M.
  return cell(values, "M") || cell(values, "K");
}

function splitLines(value: string): string[] {
  return value.split("\n").map((line) => line.replace(/\u00a0/g, "").trim());
}

function positiveAmount(value: string, column: string, rowNumber: number): number {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Row ${rowNumber}: ${column} must be greater than zero.`);
  }
  return parsed;
}

function normalizeExpiryDate(value: string, rowNumber: number): {
  iso: string;
  generatedLotNo: string;
} {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Row ${rowNumber}: expiry date '${value}' must use DD/MM/YYYY.`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    throw new Error(`Row ${rowNumber}: expiry date '${value}' is invalid.`);
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const generatedYear = String((year - 3) % 100).padStart(2, "0");
  return {
    iso,
    generatedLotNo: `${generatedYear}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
  };
}

function pendingItems(rows: readonly SpreadsheetRow[]): PendingItem[] {
  const items: PendingItem[] = [];
  let current: PendingItem | null = null;
  for (const row of rows) {
    const sequenceText = cell(row.values, "A");
    if (/^\d+$/.test(sequenceText)) {
      if (current) items.push(current);
      current = {
        sourceRow: row.rowNumber,
        sequence: Number(sequenceText),
        values: row.values,
        detailRows: [],
      };
      continue;
    }
    if (current && (cell(row.values, "H") || amountCell(row.values))) {
      current.detailRows.push(row);
    }
  }
  if (current) items.push(current);
  return items;
}

function sourceBatches(item: PendingItem, itemUnit: string): SourceBatch[] {
  const batches: SourceBatch[] = [];
  for (const row of item.detailRows) {
    // Do not trim the whole lot cell: CW uses a leading NBSP line to preserve
    // the position of a missing first lot number in a multi-line detail row.
    const lots = splitLines(rawCell(row.values, "C"));
    const expiryDates = splitLines(cell(row.values, "H"));
    const amounts = splitLines(amountCell(row.values));
    const units = splitLines(cell(row.values, "N"));
    const lineCount = Math.max(expiryDates.length, amounts.length, units.length);
    const lotsAlign = lots.length === lineCount || (lots.length === 1 && !lots[0]);
    if (
      lineCount === 0
      || !lotsAlign
      || expiryDates.length !== lineCount
      || amounts.length !== lineCount
      || units.length !== lineCount
    ) {
      throw new Error(`Row ${row.rowNumber}: lot, expiry, amount, and unit lines do not align.`);
    }

    for (let index = 0; index < lineCount; index += 1) {
      const expiry = normalizeExpiryDate(expiryDates[index] ?? "", row.rowNumber);
      const unit = units[index]?.trim() ?? "";
      if (!unit || unit !== itemUnit) {
        throw new Error(`Row ${row.rowNumber}: lot unit '${unit}' does not match item unit '${itemUnit}'.`);
      }
      const sourceLotNo = lots[index]?.trim() ?? "";
      batches.push({
        lotNo: sourceLotNo || expiry.generatedLotNo,
        expiryDate: expiry.iso,
        amount: positiveAmount(amounts[index] ?? "", "lot amount", row.rowNumber),
        unit,
        generatedLotNo: !sourceLotNo,
        sourceRows: [row.rowNumber],
        listedIndex: batches.length,
      });
    }
  }
  if (batches.length === 0) {
    throw new Error(`Row ${item.sourceRow}: at least one lot detail is required.`);
  }
  return batches;
}

function aggregateBatches(batches: readonly SourceBatch[]): NormalizedLotExpiryBatch[] {
  const byIdentity = new Map<string, NormalizedLotExpiryBatch>();
  for (const batch of batches) {
    const key = JSON.stringify([batch.lotNo, batch.expiryDate, batch.unit]);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, {
        lotNo: batch.lotNo,
        expiryDate: batch.expiryDate,
        amount: batch.amount,
        unit: batch.unit,
        generatedLotNo: batch.generatedLotNo,
        sourceRows: [...batch.sourceRows],
      });
      continue;
    }
    existing.amount += batch.amount;
    existing.generatedLotNo ||= batch.generatedLotNo;
    existing.sourceRows = [...new Set([...existing.sourceRows, ...batch.sourceRows])];
  }
  return [...byIdentity.values()];
}

export function normalizeLotExpiryRows(
  rows: readonly SpreadsheetRow[],
): NormalizedLotExpiryItem[] {
  return pendingItems(rows).map((item) => {
    const itemLabel = cell(item.values, "B");
    const itemMatch = /^\s*(P-\d+)\s*:\s*(.+?)\s*$/s.exec(itemLabel);
    if (!itemMatch) {
      throw new Error(`Row ${item.sourceRow}: item must start with a P- product code.`);
    }
    const unit = cell(item.values, "N");
    if (!unit) throw new Error(`Row ${item.sourceRow}: item unit is required.`);
    const reportedAmount = positiveAmount(
      amountCell(item.values),
      "item amount (merged K:M)",
      item.sourceRow,
    );
    const batches = sourceBatches(item, unit);
    const detailTotal = batches.reduce((sum, batch) => sum + batch.amount, 0);
    if (detailTotal > reportedAmount) {
      throw new Error(
        `Row ${item.sourceRow}: lot amount ${detailTotal} exceeds the item amount ${reportedAmount}.`,
      );
    }
    const remainderAmount = reportedAmount - detailTotal;
    if (remainderAmount > 0) {
      batches.push({
        lotNo: "",
        expiryDate: "",
        amount: remainderAmount,
        unit,
        generatedLotNo: false,
        sourceRows: [item.sourceRow],
        listedIndex: batches.length,
      });
    }

    return {
      sourceRow: item.sourceRow,
      sequence: item.sequence,
      externalProductCode: itemMatch[1],
      itemName: itemMatch[2],
      reportedAmount,
      unit,
      remainderAmount,
      batches: aggregateBatches(batches),
    };
  });
}

export function extractLotExpiryItems(
  fileName: string,
  bytes: Uint8Array,
): NormalizedLotExpiryItem[] {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Choose a CW lot and expiry XLSX file.");
  }
  const rows = readFirstXlsxWorksheet(bytes, {
    maxEntryBytes: 20 * 1024 * 1024,
    maxExpandedBytes: 40 * 1024 * 1024,
  });
  const hasRequiredHeaders = rows.some((row) => (
    cell(row.values, "A") === "ลำดับ"
    && cell(row.values, "B") === "สินค้า"
    && amountCell(row.values) === "จำนวน"
    && cell(row.values, "N") === "หน่วย"
  ));
  if (!hasRequiredHeaders) {
    throw new Error("The XLSX file is missing the required CW headers.");
  }
  const normalized = normalizeLotExpiryRows(rows);
  if (normalized.length > 20_000) {
    throw new Error("The XLSX file contains too many products.");
  }
  if (normalized.reduce((sum, item) => sum + item.batches.length, 0) > 100_000) {
    throw new Error("The XLSX file contains too many lot records.");
  }
  return normalized;
}

export function prepareLotExpiryMigration(
  normalizedItems: readonly NormalizedLotExpiryItem[],
  existingProducts: readonly ExistingLotExpiryProduct[],
  sourceBytes: Uint8Array,
): PreparedLotExpiryMigration {
  const existingByCode = new Map(existingProducts.flatMap((product) => (
    product.externalProductCode ? [[product.externalProductCode, product] as const] : []
  )));
  const rows = normalizedItems.map((item): LotExpiryMigrationRow => {
    const matched = existingByCode.get(item.externalProductCode) ?? null;
    const unitConflict = matched
      && canonicalizeProductUnit(matched.baseUnit) !== canonicalizeProductUnit(item.unit)
      ? `Database unit '${matched.baseUnit}' does not match uploaded unit '${item.unit}'.`
      : null;
    return {
      ...item,
      status: unitConflict ? "conflict" : matched ? "matched" : "unmatched",
      matchedProductId: matched?.id ?? null,
      matchedItemName: matched?.itemName ?? null,
      sellPriceThb: matched?.sellPriceThb ?? null,
      issue: unitConflict
        ?? (matched ? null : `${item.externalProductCode} does not match an existing product.`),
    };
  }).sort((left, right) => (
    PREVIEW_STATUS_PRIORITY[left.status] - PREVIEW_STATUS_PRIORITY[right.status]
    || left.sourceRow - right.sourceRow
  ));
  const reconciliation = rows.map((row) => ({
    externalProductCode: row.externalProductCode,
    status: row.status,
    matchedProductId: row.matchedProductId,
    sellPriceThb: row.sellPriceThb,
    issue: row.issue,
  }));
  const confirmationToken = createHash("sha256")
    .update(sourceBytes)
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");
  const count = (status: LotExpiryMigrationStatus): number => (
    rows.filter((row) => row.status === status).length
  );
  return {
    preview: {
      sourceSoftware: "CW",
      confirmationToken,
      summary: {
        totalProducts: rows.length,
        matchedProducts: count("matched"),
        unmatchedProducts: count("unmatched"),
        conflictProducts: count("conflict"),
        totalBatches: rows.reduce((sum, row) => sum + row.batches.length, 0),
        generatedLotCount: rows.reduce(
          (sum, row) => sum + row.batches.filter((batch) => batch.generatedLotNo).length,
          0,
        ),
        remainderProducts: rows.filter((row) => row.remainderAmount > 0).length,
      },
      rows,
    },
    importRows: rows.filter((row) => row.status === "matched"),
  };
}
