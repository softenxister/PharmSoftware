import { promises as fs } from "node:fs";
import path from "node:path";
import {
  receivePurchasedStockToFile,
  type PurchasedStockLineInput,
} from "./stockFileRepository";

const PURCHASE_BILLS_FILE_PATH = path.join(process.cwd(), "src/server/db/purchase-bills.json");

export type PurchaseBillStatus = "received" | "draft" | "partial";

export type SavedPurchaseLine = PurchasedStockLineInput & {
  id: string;
  itemName: string;
  unit: string;
  freeUnit: string;
};

export type SavedPurchaseBill = {
  id: string;
  billNo: string;
  invoiceNo: string;
  date: string;
  distributor: string;
  itemCount: number;
  totalQty: number;
  netTotal: number;
  status: PurchaseBillStatus;
  lines: SavedPurchaseLine[];
};

export type PurchaseBillInput = {
  invoiceNo?: string;
  distributor?: string;
  totalQty?: number;
  netTotal?: number;
  lines?: SavedPurchaseLine[];
};

async function readSavedPurchaseBills(): Promise<SavedPurchaseBill[]> {
  try {
    const raw = await fs.readFile(PURCHASE_BILLS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeSavedPurchaseBills(bills: SavedPurchaseBill[]) {
  await fs.mkdir(path.dirname(PURCHASE_BILLS_FILE_PATH), { recursive: true });
  await fs.writeFile(PURCHASE_BILLS_FILE_PATH, `${JSON.stringify(bills, null, 2)}\n`, "utf8");
}

function nextBillNo(bills: SavedPurchaseBill[], date: Date) {
  const dayKey = date.toISOString().slice(0, 10).replace(/-/g, "");
  const todaysCount = bills.filter((bill) => bill.billNo.includes(dayKey)).length + 1;
  return `PB-${dayKey}-${String(todaysCount).padStart(3, "0")}`;
}

export async function readPurchaseBillsFromFile(): Promise<SavedPurchaseBill[]> {
  return readSavedPurchaseBills();
}

export async function savePurchaseBillToFile(input: PurchaseBillInput): Promise<SavedPurchaseBill[]> {
  const currentBills = await readSavedPurchaseBills();
  const now = new Date();
  const lines = Array.isArray(input.lines) ? input.lines : [];

  await receivePurchasedStockToFile(lines);

  const bill: SavedPurchaseBill = {
    id: `purchase-${now.getTime()}`,
    billNo: nextBillNo(currentBills, now),
    invoiceNo: input.invoiceNo?.trim() || "Manual",
    date: now.toISOString(),
    distributor: input.distributor?.trim() || "Unknown distributor",
    itemCount: lines.length,
    totalQty: Number.isFinite(input.totalQty) ? Number(input.totalQty) : 0,
    netTotal: Number.isFinite(input.netTotal) ? Number(input.netTotal) : 0,
    status: "received",
    lines,
  };

  await writeSavedPurchaseBills([bill, ...currentBills]);
  return readSavedPurchaseBills();
}
