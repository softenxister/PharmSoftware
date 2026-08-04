import { createHash } from "node:crypto";
import {
  normalizeCwStockCsv,
  type CwStockNormalizationResult,
} from "./cwStockNormalizer";

export type CwMigrationStatus = "new" | "update" | "conflict";
export type CwMigrationMatchReason = "externalProductCode" | "barcode" | null;

export type CwExistingProductIdentity = {
  id: string;
  externalProductCode: string | null;
  itemName: string;
  barcodes: string[];
};

export type CwStockMigrationRow = {
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
  status: CwMigrationStatus;
  matchReason: CwMigrationMatchReason;
  matchedProductId: string | null;
  matchedItemName: string | null;
  issue: string | null;
};

export type CwStockMigrationSummary = {
  totalRows: number;
  totalUnits: number;
  newCount: number;
  updateCount: number;
  conflictCount: number;
  brandReviewCount: number;
};

export type CwStockMigrationPreview = {
  sourceSoftware: "CW";
  mode: "full";
  confirmationToken: string;
  summary: CwStockMigrationSummary;
  rows: CwStockMigrationRow[];
};

export type PreparedCwStockMigration = {
  preview: CwStockMigrationPreview;
  normalized: CwStockNormalizationResult;
};

export function createCwConfirmationToken(csvText: string): string {
  return createHash("sha256").update(csvText, "utf8").digest("hex");
}

function createCwPreviewConfirmationToken(
  csvText: string,
  rows: CwStockMigrationRow[],
): string {
  const reconciliation = rows.map((row) => ({
    externalProductCode: row.externalProductCode,
    status: row.status,
    matchedProductId: row.matchedProductId,
    issue: row.issue,
  }));
  return createHash("sha256")
    .update(csvText, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");
}

export function prepareCwStockMigration(
  csvText: string,
  existingProducts: CwExistingProductIdentity[],
): PreparedCwStockMigration {
  const normalized = normalizeCwStockCsv(csvText);
  const existingById = new Map(existingProducts.map((product) => [product.id, product]));
  const existingByCode = new Map(
    existingProducts
      .filter((product) => product.externalProductCode)
      .map((product) => [product.externalProductCode as string, product]),
  );
  const productIdsByBarcode = new Map<string, Set<string>>();
  const unitsByProductCode = new Map<string, CwStockNormalizationResult["units"]>();

  for (const product of existingProducts) {
    for (const barcode of product.barcodes) {
      const owners = productIdsByBarcode.get(barcode) ?? new Set<string>();
      owners.add(product.id);
      productIdsByBarcode.set(barcode, owners);
    }
  }

  for (const unit of normalized.units) {
    const units = unitsByProductCode.get(unit.externalProductCode) ?? [];
    units.push(unit);
    unitsByProductCode.set(unit.externalProductCode, units);
  }

  const rows = normalized.products.map((product): CwStockMigrationRow => {
    const units = unitsByProductCode.get(product.externalProductCode) ?? [];
    const uploadedBarcodes = units.flatMap((unit) => unit.barcodes);
    const barcodeMatchIds = new Set(
      uploadedBarcodes.flatMap((barcode) => [...(productIdsByBarcode.get(barcode) ?? [])]),
    );
    const codeMatch = existingByCode.get(product.externalProductCode) ?? null;

    let status: CwMigrationStatus = "new";
    let matchReason: CwMigrationMatchReason = null;
    let matchedProduct: CwExistingProductIdentity | null = null;
    let issue: string | null = null;

    if (codeMatch) {
      const otherBarcodeOwners = [...barcodeMatchIds].filter((id) => id !== codeMatch.id);
      if (otherBarcodeOwners.length > 0) {
        status = "conflict";
        issue = "A barcode in this row belongs to another product.";
      } else {
        status = "update";
        matchReason = "externalProductCode";
        matchedProduct = codeMatch;
      }
    } else if (barcodeMatchIds.size === 1) {
      status = "update";
      matchReason = "barcode";
      matchedProduct = existingById.get([...barcodeMatchIds][0]) ?? null;
    } else if (barcodeMatchIds.size > 1) {
      status = "conflict";
      issue = "Uploaded barcodes match multiple existing products.";
    }

    return {
      externalProductCode: product.externalProductCode,
      itemName: product.itemName,
      brandName: product.brandName,
      brandConfidence: product.brandConfidence,
      brandMatchedAlias: product.brandMatchedAlias,
      baseUnit: product.baseUnit,
      baseBarcode: product.baseBarcode,
      genericName: product.genericName,
      lastCostThb: product.lastCostThb,
      availableStock: product.availableStock,
      baseSellPriceThb: product.baseSellPriceThb,
      unitCount: units.length,
      units: units.map((unit) => ({
        unitName: unit.unitName,
        quantityInBaseUnit: unit.quantityInBaseUnit,
        isBaseUnit: unit.isBaseUnit,
        barcodes: unit.barcodes,
        sellPriceThb: unit.sellPriceThb,
      })),
      status,
      matchReason,
      matchedProductId: matchedProduct?.id ?? null,
      matchedItemName: matchedProduct?.itemName ?? null,
      issue,
    };
  });

  const count = (status: CwMigrationStatus) => rows.filter((row) => row.status === status).length;
  return {
    normalized,
    preview: {
      sourceSoftware: "CW",
      mode: "full",
      confirmationToken: createCwPreviewConfirmationToken(csvText, rows),
      summary: {
        totalRows: rows.length,
        totalUnits: normalized.units.length,
        newCount: count("new"),
        updateCount: count("update"),
        conflictCount: count("conflict"),
        brandReviewCount: rows.filter((row) => row.brandConfidence === "review").length,
      },
      rows,
    },
  };
}

export function buildCwStockMigrationPreview(
  csvText: string,
  existingProducts: CwExistingProductIdentity[],
): CwStockMigrationPreview {
  return prepareCwStockMigration(csvText, existingProducts).preview;
}
