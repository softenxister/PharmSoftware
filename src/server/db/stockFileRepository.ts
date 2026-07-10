import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createSavedStockItem,
  savedStockToSalesProduct,
  salesProducts,
  type ProductBatch,
  type SalesProduct,
  type SavedStockItem,
  type StockItemInput,
} from "./database";

const STOCK_FILE_PATH = path.join(process.cwd(), "src/server/db/stock-items.json");
const STOCK_OVERRIDES_FILE_PATH = path.join(process.cwd(), "src/server/db/stock-overrides.json");

export type PurchasedStockLineInput = {
  productId: string;
  barcode: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unitMultiplier: number;
  freeQuantity: number;
  freeUnitMultiplier: number;
  cost: number;
};

type StockProductOverride = {
  productId: string;
  barcode: string;
  batches: ProductBatch[];
};

async function readSavedStockItems(): Promise<SavedStockItem[]> {
  try {
    const raw = await fs.readFile(STOCK_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeSavedStockItems(items: SavedStockItem[]) {
  await fs.mkdir(path.dirname(STOCK_FILE_PATH), { recursive: true });
  await fs.writeFile(STOCK_FILE_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function readStockOverrides(): Promise<StockProductOverride[]> {
  try {
    const raw = await fs.readFile(STOCK_OVERRIDES_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeStockOverrides(overrides: StockProductOverride[]) {
  await fs.mkdir(path.dirname(STOCK_OVERRIDES_FILE_PATH), { recursive: true });
  await fs.writeFile(STOCK_OVERRIDES_FILE_PATH, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

function applyStockOverrides(products: SalesProduct[], overrides: StockProductOverride[]): SalesProduct[] {
  if (overrides.length === 0) return products;

  return products.map((product) => {
    const override = overrides.find((item) => (
      item.productId === product.id || item.barcode.trim() === product.barcode.trim()
    ));

    return override ? { ...product, batches: override.batches } : product;
  });
}

export async function readStockProductsFromFile(): Promise<SalesProduct[]> {
  const savedItems = await readSavedStockItems();
  const stockOverrides = await readStockOverrides();
  const savedBarcodes = new Set(savedItems.map((item) => item.barcode.trim()));
  const seedProducts = salesProducts.filter((product) => !savedBarcodes.has(product.barcode.trim()));

  return applyStockOverrides([...seedProducts, ...savedItems.map(savedStockToSalesProduct)], stockOverrides);
}

export async function saveStockItemToFile(input: StockItemInput): Promise<SalesProduct[]> {
  const savedItems = await readSavedStockItems();
  const barcode = input.barcode.trim();
  const currentItem = savedItems.find((item) => item.barcode.trim() === barcode);
  const savedItem = createSavedStockItem(input, currentItem);
  const nextItems = [
    savedItem,
    ...savedItems.filter((item) => item.barcode.trim() !== barcode),
  ];

  await writeSavedStockItems(nextItems);
  return readStockProductsFromFile();
}

export async function saveStockItemsToFile(inputs: StockItemInput[]): Promise<SalesProduct[]> {
  let products = await readStockProductsFromFile();

  for (const input of inputs) {
    products = await saveStockItemToFile(input);
  }

  return products;
}

export async function receivePurchasedStockToFile(lines: PurchasedStockLineInput[]): Promise<SalesProduct[]> {
  const products = await readStockProductsFromFile();
  const overrides = await readStockOverrides();
  const overrideByProductKey = new Map<string, StockProductOverride>();

  overrides.forEach((override) => {
    overrideByProductKey.set(override.productId, override);
    overrideByProductKey.set(override.barcode.trim(), override);
  });

  lines.forEach((line) => {
    const product = products.find((item) => (
      item.id === line.productId || item.barcode.trim() === line.barcode.trim()
    ));
    if (!product) return;

    const purchasedQty = Math.max(0, line.quantity) * Math.max(1, line.unitMultiplier);
    const freeQty = Math.max(0, line.freeQuantity) * Math.max(1, line.freeUnitMultiplier);
    const stockQty = purchasedQty + freeQty;
    if (!Number.isFinite(stockQty) || stockQty <= 0) return;

    const existingOverride = overrideByProductKey.get(product.id) ?? overrideByProductKey.get(product.barcode.trim());
    const nextBatches = (existingOverride?.batches ?? product.batches).map((batch) => ({ ...batch }));
    const fallbackBatch = nextBatches[0] ?? product.batches[0];
    const batchNo = line.batchNo.trim() || fallbackBatch?.batchNo || `PUR-${new Date().toISOString().slice(0, 10)}`;
    const batchIndex = nextBatches.findIndex((batch) => batch.batchNo.trim() === batchNo);

    if (batchIndex >= 0) {
      nextBatches[batchIndex] = {
        ...nextBatches[batchIndex],
        expiryDate: line.expiryDate.trim() || nextBatches[batchIndex].expiryDate,
        availableStock: nextBatches[batchIndex].availableStock + stockQty,
      };
    } else {
      nextBatches.push({
        batchNo,
        expiryDate: line.expiryDate.trim() || fallbackBatch?.expiryDate || "",
        sellPriceThb: fallbackBatch?.sellPriceThb || line.cost || 0,
        availableStock: stockQty,
      });
    }

    const nextOverride = {
      productId: product.id,
      barcode: product.barcode.trim(),
      batches: nextBatches,
    };

    overrideByProductKey.set(product.id, nextOverride);
    overrideByProductKey.set(product.barcode.trim(), nextOverride);
  });

  const nextOverridesByProductId = new Map<string, StockProductOverride>();
  overrideByProductKey.forEach((override) => {
    nextOverridesByProductId.set(override.productId, override);
  });

  await writeStockOverrides(Array.from(nextOverridesByProductId.values()));
  return readStockProductsFromFile();
}
