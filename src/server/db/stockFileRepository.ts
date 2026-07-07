import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createSavedStockItem,
  savedStockToSalesProduct,
  salesProducts,
  type SalesProduct,
  type SavedStockItem,
  type StockItemInput,
} from "./database";

const STOCK_FILE_PATH = path.join(process.cwd(), "src/server/db/stock-items.json");

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

export async function readStockProductsFromFile(): Promise<SalesProduct[]> {
  const savedItems = await readSavedStockItems();
  const savedBarcodes = new Set(savedItems.map((item) => item.barcode.trim()));
  const seedProducts = salesProducts.filter((product) => !savedBarcodes.has(product.barcode.trim()));

  return [...seedProducts, ...savedItems.map(savedStockToSalesProduct)];
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
