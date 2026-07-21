export const CW_STOCK_HEADERS = [
  "ลำดับ",
  "Active",
  "รหัสสินค้า",
  "บาร์โค้ด",
  "ชื่อสินค้า(เต็ม)",
  "หน่วยฐาน",
  "ชื่อสามัญ",
  "กลุ่มสินค้า",
  "ราคาทุนรับหลังสุด",
  "หน่วยสินค้า",
  "จำนวนคงเหลือ",
  "ราคาปลีก 1",
  "กลุ่มใบอนุญาต",
  "บริษัทผลิต",
] as const;

import { extractThaiPharmacyBrand } from "./thaiBrandExtractor";

type CwStockHeader = (typeof CW_STOCK_HEADERS)[number];
type CsvRecord = Record<CwStockHeader, string>;

export type NormalizedStockUnit = {
  externalProductCode: string;
  unitName: string;
  quantityInBaseUnit: number;
  isBaseUnit: boolean;
  barcodes: string[];
  barcodeDisplay: string;
  sellPriceThb: number;
  sourceRow: number;
};

export type NormalizedStockProduct = {
  externalProductCode: string;
  isActive: boolean;
  baseBarcode: string;
  barcodeDisplay: string;
  itemName: string;
  brandName: string | null;
  brandConfidence: "high" | "medium" | "review";
  brandMatchedAlias: string | null;
  baseUnit: string;
  genericName: string;
  category: string;
  lastCostThb: number;
  availableStock: number;
  baseSellPriceThb: number;
  licenseGroup: string;
  manufacturerName: string;
  sourceManufacturer: string;
  sourceRow: number;
};

export type PrismaStockImportPreview = {
  product: {
    id: string;
    externalProductCode: string;
    barcode: string;
    itemName: string;
    brandName: string;
    manufacturerName: string;
    categoryName: string;
    packUnit: string;
    childUnit: string;
    childQuantity: number;
    packLabel: string;
    location: string;
    imageUrl: string;
    isActive: boolean;
  };
  parentPacks: Array<{
    packUnit: string;
    childPackUnit: string;
    childPackQuantity: number;
    label: string;
    priceMultiplier: number;
    barcode: string | null;
    sellPriceThb: number;
  }>;
  barcodeAliases: Array<{
    barcode: string;
    unitName: string;
    quantityInBaseUnit: number;
  }>;
  batch: {
    batchNo: string;
    expiryDate: string;
    sellPriceThb: number;
    availableStock: number;
  };
  source: {
    genericName: string;
    licenseGroup: string;
    lastCostThb: number;
  };
};

export type CwStockNormalizationResult = {
  products: NormalizedStockProduct[];
  units: NormalizedStockUnit[];
  prismaImportPreview: PrismaStockImportPreview[];
  warnings: string[];
};

type ParsedUnitCell = {
  unitName: string;
  bracketQuantity: number | null;
  value: string;
};

type ProductGroup = {
  sourceRow: number;
  productRow: CsvRecord;
  unitRows: Array<{ sourceRow: number; row: CsvRecord }>;
};

function parseCsvRows(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function rowsToRecords(csvText: string): CsvRecord[] {
  const rows = parseCsvRows(csvText);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  const missingHeaders = CW_STOCK_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(", ")}`);
  }

  return rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => Object.fromEntries(
      CW_STOCK_HEADERS.map((header) => [header, row[headers.indexOf(header)]?.trim() ?? ""]),
    ) as CsvRecord);
}

function parseUnitCell(value: string, column: string, sourceRow: number): ParsedUnitCell {
  const match = value.trim().match(/^(.+?)(?:\[([0-9]+(?:\.[0-9]+)?)\])?\s*:\s*(.*)$/);
  if (!match) throw new Error(`Row ${sourceRow}: invalid ${column} value '${value}'.`);
  return {
    unitName: match[1].trim(),
    bracketQuantity: match[2] ? Number(match[2]) : null,
    value: match[3].trim(),
  };
}

function finiteNumber(value: string, column: string, sourceRow: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Row ${sourceRow}: ${column} must be a number.`);
  return parsed;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function cleanManufacturer(value: string): string {
  return value.replace(/^SPR-[^:]+:\s*/i, "").trim();
}

function productId(externalProductCode: string): string {
  const suffix = externalProductCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `cw-${suffix || "product"}`;
}

function parseUnit(
  externalProductCode: string,
  baseUnit: string,
  row: CsvRecord,
  sourceRow: number,
): NormalizedStockUnit {
  const barcodeCell = parseUnitCell(row["บาร์โค้ด"], "บาร์โค้ด", sourceRow);
  const quantityCell = parseUnitCell(row["หน่วยสินค้า"], "หน่วยสินค้า", sourceRow);
  const priceCell = parseUnitCell(row["ราคาปลีก 1"], "ราคาปลีก 1", sourceRow);
  const unitNames = new Set([barcodeCell.unitName, quantityCell.unitName, priceCell.unitName]);
  if (unitNames.size !== 1) {
    throw new Error(`Row ${sourceRow}: unit labels do not match across barcode, quantity, and price.`);
  }

  const quantity = finiteNumber(quantityCell.value, "หน่วยสินค้า", sourceRow);
  if (quantity <= 0) throw new Error(`Row ${sourceRow}: หน่วยสินค้า must be greater than zero.`);
  for (const bracketQuantity of [barcodeCell.bracketQuantity, quantityCell.bracketQuantity, priceCell.bracketQuantity]) {
    if (bracketQuantity !== null && bracketQuantity !== quantity) {
      throw new Error(`Row ${sourceRow}: bracket quantity does not equal หน่วยสินค้า (${quantity}).`);
    }
  }

  const barcodes = [...new Set(
    barcodeCell.value.split(",").map((barcode) => barcode.trim()).filter(Boolean),
  )];
  if (barcodes.length === 0) throw new Error(`Row ${sourceRow}: at least one barcode is required.`);
  const sellPriceThb = finiteNumber(priceCell.value, "ราคาปลีก 1", sourceRow);
  const unitName = barcodeCell.unitName;
  return {
    externalProductCode,
    unitName,
    quantityInBaseUnit: quantity,
    isBaseUnit: unitName === baseUnit && quantity === 1,
    barcodes,
    barcodeDisplay: `${unitName}[${formatQuantity(quantity)}] : ${barcodes.join(", ")}`,
    sellPriceThb,
    sourceRow,
  };
}

function mergeEquivalentProductUnits(units: NormalizedStockUnit[]): NormalizedStockUnit[] {
  const mergedByDefinition = new Map<string, NormalizedStockUnit>();
  for (const unit of units) {
    const key = JSON.stringify([unit.unitName, unit.quantityInBaseUnit]);
    const existing = mergedByDefinition.get(key);
    if (!existing) {
      mergedByDefinition.set(key, { ...unit, barcodes: [...unit.barcodes] });
      continue;
    }
    if (existing.sellPriceThb !== unit.sellPriceThb) {
      throw new Error(
        `Row ${unit.sourceRow}: ${unit.unitName}[${formatQuantity(unit.quantityInBaseUnit)}] has conflicting prices.`,
      );
    }
    existing.barcodes = [...new Set([...existing.barcodes, ...unit.barcodes])];
    existing.barcodeDisplay = `${existing.unitName}[${formatQuantity(existing.quantityInBaseUnit)}] : ${existing.barcodes.join(", ")}`;
  }
  return [...mergedByDefinition.values()];
}

function groupProductRows(records: CsvRecord[]): ProductGroup[] {
  const groups: ProductGroup[] = [];
  let current: ProductGroup | null = null;

  records.forEach((row, index) => {
    const sourceRow = index + 2;
    if (row["รหัสสินค้า"]) {
      current = { sourceRow, productRow: row, unitRows: [] };
      groups.push(current);
    }
    if (!current) throw new Error(`Row ${sourceRow}: unit row appears before the first product.`);
    current.unitRows.push({ sourceRow, row });
  });
  return groups;
}

export function normalizeCwStockCsv(csvText: string): CwStockNormalizationResult {
  const groups = groupProductRows(rowsToRecords(csvText));
  const products: NormalizedStockProduct[] = [];
  const units: NormalizedStockUnit[] = [];
  const prismaImportPreview: PrismaStockImportPreview[] = [];
  const warnings: string[] = [];
  const productCodes = new Set<string>();
  const barcodeOwners = new Map<string, string>();

  for (const group of groups) {
    const row = group.productRow;
    const externalProductCode = row["รหัสสินค้า"];
    if (productCodes.has(externalProductCode)) {
      throw new Error(`Row ${group.sourceRow}: duplicate รหัสสินค้า '${externalProductCode}'.`);
    }
    productCodes.add(externalProductCode);

    const baseUnit = row["หน่วยฐาน"];
    if (!baseUnit) throw new Error(`Row ${group.sourceRow}: หน่วยฐาน is required.`);
    const productUnits = mergeEquivalentProductUnits(
      group.unitRows.map(({ row: unitRow, sourceRow }) => (
        parseUnit(externalProductCode, baseUnit, unitRow, sourceRow)
      )),
    );
    const baseUnits = productUnits.filter((unit) => unit.isBaseUnit);
    if (baseUnits.length !== 1) {
      throw new Error(`Row ${group.sourceRow}: expected exactly one ${baseUnit}[1] base unit.`);
    }
    const base = baseUnits[0];

    for (const unit of productUnits) {
      for (const barcode of unit.barcodes) {
        const owner = barcodeOwners.get(barcode);
        if (owner) throw new Error(`Row ${unit.sourceRow}: barcode '${barcode}' is already used by ${owner}.`);
        barcodeOwners.set(barcode, externalProductCode);
      }
    }

    const sourceManufacturer = row["บริษัทผลิต"];
    const manufacturerName = cleanManufacturer(sourceManufacturer) || "Unknown manufacturer";
    const category = row["กลุ่มสินค้า"] || "Uncategorized";
    const brand = extractThaiPharmacyBrand(row["ชื่อสินค้า(เต็ม)"]);
    const normalizedProduct: NormalizedStockProduct = {
      externalProductCode,
      isActive: row.Active.trim().toLowerCase() === "true",
      baseBarcode: base.barcodes[0],
      barcodeDisplay: productUnits.map((unit) => unit.barcodeDisplay).join(" | "),
      itemName: row["ชื่อสินค้า(เต็ม)"],
      brandName: brand.brandName,
      brandConfidence: brand.confidence,
      brandMatchedAlias: brand.matchedAlias,
      baseUnit,
      genericName: row["ชื่อสามัญ"],
      category,
      lastCostThb: finiteNumber(row["ราคาทุนรับหลังสุด"] || "0", "ราคาทุนรับหลังสุด", group.sourceRow),
      availableStock: finiteNumber(row["จำนวนคงเหลือ"] || "0", "จำนวนคงเหลือ", group.sourceRow),
      baseSellPriceThb: base.sellPriceThb,
      licenseGroup: row["กลุ่มใบอนุญาต"],
      manufacturerName,
      sourceManufacturer,
      sourceRow: group.sourceRow,
    };
    products.push(normalizedProduct);
    units.push(...productUnits);

    const aliases = productUnits.flatMap((unit) => unit.barcodes.slice(1).map((barcode) => ({
      barcode,
      unitName: unit.unitName,
      quantityInBaseUnit: unit.quantityInBaseUnit,
    })));
    const parentPacks = productUnits.filter((unit) => !unit.isBaseUnit).map((unit) => ({
      packUnit: unit.unitName,
      childPackUnit: baseUnit,
      childPackQuantity: unit.quantityInBaseUnit,
      label: `1 ${unit.unitName} = ${formatQuantity(unit.quantityInBaseUnit)} ${baseUnit}`,
      priceMultiplier: unit.quantityInBaseUnit,
      barcode: unit.barcodes[0] ?? null,
      sellPriceThb: unit.sellPriceThb,
    }));

    prismaImportPreview.push({
      product: {
        id: productId(externalProductCode),
        externalProductCode,
        barcode: normalizedProduct.baseBarcode,
        itemName: normalizedProduct.itemName,
        brandName: normalizedProduct.brandName ?? "Unspecified",
        manufacturerName,
        categoryName: category,
        packUnit: baseUnit,
        childUnit: baseUnit,
        childQuantity: 1,
        packLabel: `1 ${baseUnit}`,
        location: "-",
        imageUrl: "",
        isActive: normalizedProduct.isActive,
      },
      parentPacks,
      barcodeAliases: aliases,
      batch: {
        batchNo: "CW-IMPORT",
        expiryDate: "",
        sellPriceThb: normalizedProduct.baseSellPriceThb,
        availableStock: normalizedProduct.availableStock,
      },
      source: {
        genericName: normalizedProduct.genericName,
        licenseGroup: normalizedProduct.licenseGroup,
        lastCostThb: normalizedProduct.lastCostThb,
      },
    });
  }

  return { products, units, prismaImportPreview, warnings };
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: readonly (keyof T)[]): string {
  const escapeCell = (value: unknown) => {
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.map(escapeCell).join(","),
    ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(",")),
  ].join("\r\n");
}
