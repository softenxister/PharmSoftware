import { createHash } from "node:crypto";
import type { XlsxWorksheetRow } from "./xlsxWorksheet";

export type ExistingPurchaseHistoryCustomer = {
  id: string;
  memberCode: string | null;
  name: string;
};

export type ExistingPurchaseHistoryProduct = {
  id: string;
  externalProductCode: string | null;
  itemName: string;
};

export type CustomerPurchaseHistoryStatus =
  | "matched"
  | "duplicate"
  | "unmatched_customer"
  | "unmatched_product"
  | "conflict";

export type ParsedCustomerPurchaseHistoryRow = {
  customerRowNumber: number;
  rowNumber: number;
  customerCode: string;
  customerName: string;
  externalProductCode: string;
  sourceItemName: string;
  unit: string;
  quantity: number;
  totalAmount: number;
  issue: string | null;
};

export type CustomerPurchaseHistoryMigrationRow = ParsedCustomerPurchaseHistoryRow & {
  status: CustomerPurchaseHistoryStatus;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedProductId: string | null;
  matchedItemName: string | null;
};

export type CustomerPurchaseHistoryPreview = {
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

export type PreparedCustomerPurchaseHistoryMigration = {
  preview: CustomerPurchaseHistoryPreview;
  importRows: CustomerPurchaseHistoryMigrationRow[];
  reportPeriod: { startedAt: Date | null; endedAt: Date | null };
};

type CustomerSection = {
  rowNumber: number;
  code: string;
  name: string;
  issue: string | null;
};

function parseCwLabel(value: string, prefix: "C" | "P"): { code: string; label: string } | null {
  const match = new RegExp(`^(${prefix}-[A-Z0-9-]+)\\s*:\\s*(.*)$`, "i").exec(value.trim());
  return match ? { code: match[1].toUpperCase(), label: match[2].trim() } : null;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseReportDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12));
  return date.getUTCFullYear() === Number(match[3])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[1])
    ? date
    : null;
}

function reportPeriod(rows: readonly XlsxWorksheetRow[]) {
  for (const row of rows) {
    for (const value of row.values.values()) {
      const match = /วันที่\s+(\d{2}\/\d{2}\/\d{4})\s+ถึง\s+(\d{2}\/\d{2}\/\d{4})/.exec(value);
      if (!match) continue;
      return { startedAt: parseReportDate(match[1]), endedAt: parseReportDate(match[2]) };
    }
  }
  return { startedAt: null, endedAt: null };
}

function invalidRowIssue(row: Omit<ParsedCustomerPurchaseHistoryRow, "issue">): string | null {
  if (!row.customerCode) return `Customer code is missing or invalid at row ${row.customerRowNumber}.`;
  if (!row.externalProductCode) return "Product code must use the P-...: item name format.";
  if (!row.unit) return "Unit is required.";
  if (!(row.quantity > 0)) return "Quantity must be greater than zero.";
  if (!(row.totalAmount > 0)) return "Total purchase amount must be greater than zero.";
  return null;
}

export function parseCustomerPurchaseHistoryRows(rows: readonly XlsxWorksheetRow[]) {
  const parsedRows: ParsedCustomerPurchaseHistoryRow[] = [];
  let currentCustomer: CustomerSection | null = null;

  for (const sourceRow of rows) {
    const sequence = (sourceRow.values.get("A") ?? "").trim();
    if (/^\d+$/.test(sequence)) {
      if (Number(sequence) >= 2) {
        const customer = parseCwLabel(sourceRow.values.get("B") ?? "", "C");
        currentCustomer = {
          rowNumber: sourceRow.rowNumber,
          code: customer?.code ?? "",
          name: customer?.label ?? "",
          issue: customer ? null : `Customer code is missing or invalid at row ${sourceRow.rowNumber}.`,
        };
      } else {
        currentCustomer = null;
      }
      continue;
    }
    if (!currentCustomer) continue;

    const rawProduct = (sourceRow.values.get("C") ?? "").trim();
    if (!rawProduct) continue;
    const product = parseCwLabel(rawProduct, "P");
    const unit = (sourceRow.values.get("G") ?? "").trim();
    const quantity = parsePositiveNumber(sourceRow.values.get("H") ?? "") ?? 0;
    // CW merges K:M. Depending on the producer, the stored anchor can be K, L, or M.
    const totalAmount = parsePositiveNumber(
      sourceRow.values.get("M")
        || sourceRow.values.get("L")
        || sourceRow.values.get("K")
        || "",
    ) ?? 0;
    const rowWithoutIssue = {
      customerRowNumber: currentCustomer.rowNumber,
      rowNumber: sourceRow.rowNumber,
      customerCode: currentCustomer.code,
      customerName: currentCustomer.name,
      externalProductCode: product?.code ?? "",
      sourceItemName: product?.label ?? rawProduct,
      unit,
      quantity,
      totalAmount,
    };
    parsedRows.push({
      ...rowWithoutIssue,
      issue: currentCustomer.issue ?? invalidRowIssue(rowWithoutIssue),
    });
  }

  return { rows: parsedRows, reportPeriod: reportPeriod(rows) };
}

function normalizedCode(value: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

const previewStatusOrder: Record<CustomerPurchaseHistoryStatus, number> = {
  conflict: 0,
  unmatched_customer: 1,
  unmatched_product: 2,
  duplicate: 3,
  matched: 4,
};

function sourceHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function prepareCustomerPurchaseHistoryMigration(input: {
  fileName: string;
  fileBytes: Uint8Array;
  worksheetRows: readonly XlsxWorksheetRow[];
  existingCustomers: readonly ExistingPurchaseHistoryCustomer[];
  existingProducts: readonly ExistingPurchaseHistoryProduct[];
  duplicateSourceRows?: ReadonlySet<number>;
}): PreparedCustomerPurchaseHistoryMigration {
  const parsed = parseCustomerPurchaseHistoryRows(input.worksheetRows);
  const customersByCode = new Map(input.existingCustomers.flatMap((customer) => {
    const code = normalizedCode(customer.memberCode);
    return code ? [[code, customer] as const] : [];
  }));
  const productsByCode = new Map(input.existingProducts.flatMap((product) => {
    const code = normalizedCode(product.externalProductCode);
    return code ? [[code, product] as const] : [];
  }));
  const duplicateRows = input.duplicateSourceRows ?? new Set<number>();

  const rows: CustomerPurchaseHistoryMigrationRow[] = parsed.rows.map((row) => {
    const customer = customersByCode.get(normalizedCode(row.customerCode)) ?? null;
    const product = productsByCode.get(normalizedCode(row.externalProductCode)) ?? null;
    let status: CustomerPurchaseHistoryStatus = "matched";
    let issue = row.issue;
    if (issue) status = "conflict";
    else if (!customer) {
      status = "unmatched_customer";
      issue = `Customer code ${row.customerCode} from row ${row.customerRowNumber} was not found.`;
    } else if (!product) {
      status = "unmatched_product";
      issue = `Product code ${row.externalProductCode} was not found.`;
    } else if (duplicateRows.has(row.rowNumber)) {
      status = "duplicate";
      issue = "This source row was already imported from the same report.";
    }
    return {
      ...row,
      issue,
      status,
      matchedCustomerId: customer?.id ?? null,
      matchedCustomerName: customer?.name ?? null,
      matchedProductId: product?.id ?? null,
      matchedItemName: product?.itemName ?? null,
    };
  }).sort((first, second) => (
    previewStatusOrder[first.status] - previewStatusOrder[second.status]
    || first.rowNumber - second.rowNumber
  ));

  const count = (status: CustomerPurchaseHistoryStatus) => rows.filter((row) => row.status === status).length;
  const fileHash = sourceHash(input.fileBytes);
  const reconciliation = rows.map((row) => ({
    rowNumber: row.rowNumber,
    status: row.status,
    matchedCustomerId: row.matchedCustomerId,
    matchedProductId: row.matchedProductId,
    issue: row.issue,
  }));
  const confirmationToken = createHash("sha256")
    .update(input.fileName, "utf8")
    .update("\0", "utf8")
    .update(fileHash, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");

  return {
    preview: {
      sourceSoftware: "CW",
      sourceFileHash: fileHash,
      confirmationToken,
      reportPeriod: {
        startedAt: parsed.reportPeriod.startedAt?.toISOString() ?? null,
        endedAt: parsed.reportPeriod.endedAt?.toISOString() ?? null,
      },
      summary: {
        totalRows: rows.length,
        matchedCount: count("matched"),
        duplicateCount: count("duplicate"),
        unmatchedCustomerCount: count("unmatched_customer"),
        unmatchedProductCount: count("unmatched_product"),
        conflictCount: count("conflict"),
      },
      rows,
    },
    importRows: rows.filter((row) => row.status === "matched"),
    reportPeriod: parsed.reportPeriod,
  };
}
