import { promises as fs } from "node:fs";
import path from "node:path";
import {
  normalizeCwStockCsv,
  toCsv,
  type NormalizedStockProduct,
  type NormalizedStockUnit,
} from "@server/import/cwStockNormalizer";

const inputPath = path.resolve(process.argv[2] ?? "cw_all_stock_head_100.csv");
const outputDirectory = path.resolve(
  process.argv[3] ?? "data/outputs/cw-stock-normalized",
);

const productColumns: readonly (keyof NormalizedStockProduct)[] = [
  "externalProductCode",
  "isActive",
  "baseBarcode",
  "barcodeDisplay",
  "itemName",
  "brandName",
  "brandConfidence",
  "brandMatchedAlias",
  "baseUnit",
  "genericName",
  "category",
  "lastCostThb",
  "availableStock",
  "baseSellPriceThb",
  "licenseGroup",
  "manufacturerName",
  "sourceManufacturer",
  "sourceRow",
];

const unitColumns: readonly (keyof NormalizedStockUnit)[] = [
  "externalProductCode",
  "unitName",
  "quantityInBaseUnit",
  "isBaseUnit",
  "barcodes",
  "barcodeDisplay",
  "sellPriceThb",
  "sourceRow",
];

const source = await fs.readFile(inputPath, "utf8");
const result = normalizeCwStockCsv(source);
const brandConfidenceCounts = {
  high: result.products.filter((product) => product.brandConfidence === "high").length,
  medium: result.products.filter((product) => product.brandConfidence === "medium").length,
  review: result.products.filter((product) => product.brandConfidence === "review").length,
};
await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDirectory, "normalized_products.csv"),
    `\uFEFF${toCsv(result.products, productColumns)}\r\n`,
  ),
  fs.writeFile(
    path.join(outputDirectory, "normalized_product_units.csv"),
    `\uFEFF${toCsv(result.units, unitColumns)}\r\n`,
  ),
  fs.writeFile(
    path.join(outputDirectory, "prisma_import_preview.json"),
    `${JSON.stringify(result.prismaImportPreview, null, 2)}\n`,
  ),
  fs.writeFile(
    path.join(outputDirectory, "normalization_report.json"),
    `${JSON.stringify({
      source: inputPath,
      productCount: result.products.length,
      unitCount: result.units.length,
      multiUnitProductCount: result.prismaImportPreview.filter((item) => item.parentPacks.length > 0).length,
      brandConfidenceCounts,
      brandReviewProductCodes: result.products
        .filter((product) => product.brandConfidence === "review")
        .map((product) => product.externalProductCode),
      warnings: result.warnings,
    }, null, 2)}\n`,
  ),
]);

console.log(JSON.stringify({
  outputDirectory,
  productCount: result.products.length,
  unitCount: result.units.length,
  brandConfidenceCounts,
  warningCount: result.warnings.length,
}, null, 2));
