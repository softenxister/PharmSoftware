import { Prisma, PurchaseBillStatus as PrismaPurchaseBillStatus } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import {
  receivePurchasedStock,
  type PurchasedStockLineInput,
} from "./stockRepository";

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

const purchaseBillGraph = {
  lines: { orderBy: { id: "asc" as const } },
};

type PurchaseBillRow = Prisma.PurchaseBillGetPayload<{ include: typeof purchaseBillGraph }>;

function savedStatus(status: PrismaPurchaseBillStatus): PurchaseBillStatus {
  if (status === PrismaPurchaseBillStatus.DRAFT) return "draft";
  if (status === PrismaPurchaseBillStatus.PARTIAL) return "partial";
  return "received";
}

function purchaseBillRowToSavedBill(bill: PurchaseBillRow): SavedPurchaseBill {
  return {
    id: bill.id,
    billNo: bill.billNo,
    invoiceNo: bill.invoiceNo,
    date: bill.purchasedAt.toISOString(),
    distributor: bill.distributorName,
    itemCount: bill.itemCount,
    totalQty: Number(bill.totalQty),
    netTotal: Number(bill.netTotal),
    status: savedStatus(bill.status),
    lines: bill.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      barcode: line.barcode,
      itemName: line.itemName,
      unit: line.unit,
      unitMultiplier: Number(line.unitMultiplier),
      quantity: Number(line.quantity),
      cost: Number(line.cost),
      freeUnit: line.freeUnit,
      freeUnitMultiplier: Number(line.freeUnitMultiplier),
      freeQuantity: Number(line.freeQuantity),
      batchNo: line.batchNo,
      expiryDate: line.expiryDate,
    })),
  };
}

export async function readPurchaseBills(): Promise<SavedPurchaseBill[]> {
  const bills = await prisma.purchaseBill.findMany({
    include: purchaseBillGraph,
    orderBy: { purchasedAt: "desc" },
    take: 100,
  });
  return bills.map(purchaseBillRowToSavedBill);
}

export async function readDistributorNames(): Promise<string[]> {
  const distributors = await prisma.distributor.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return distributors.map((distributor) => distributor.name);
}

export async function savePurchaseBill(input: PurchaseBillInput): Promise<SavedPurchaseBill[]> {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length === 0) throw new Error("A purchase bill requires at least one item.");

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10).replace(/-/g, "");
  const billPrefix = `PB-${dayKey}-`;
  const distributorName = input.distributor?.trim() || "Unknown distributor";
  const totalQty = Number(input.totalQty);
  const netTotal = Number(input.netTotal);
  if (!Number.isFinite(totalQty) || totalQty <= 0 || !Number.isFinite(netTotal) || netTotal < 0) {
    throw new Error("Purchase totals are invalid.");
  }

  await prisma.$transaction(async (tx) => {
    const [billCount, distributor] = await Promise.all([
      tx.purchaseBill.count({ where: { billNo: { startsWith: billPrefix } } }),
      tx.distributor.upsert({
        where: { name: distributorName },
        update: {},
        create: { name: distributorName },
      }),
    ]);
    const billNo = `${billPrefix}${String(billCount + 1).padStart(3, "0")}`;

    await receivePurchasedStock(tx, lines);
    await tx.purchaseBill.create({
      data: {
        id: `purchase-${now.getTime()}`,
        billNo,
        invoiceNo: input.invoiceNo?.trim() || "Manual",
        purchasedAt: now,
        distributorId: distributor.id,
        distributorName,
        itemCount: lines.length,
        totalQty,
        netTotal,
        status: PrismaPurchaseBillStatus.RECEIVED,
        lines: {
          create: lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            barcode: line.barcode,
            itemName: line.itemName,
            unit: line.unit,
            unitMultiplier: line.unitMultiplier,
            quantity: line.quantity,
            cost: line.cost,
            freeUnit: line.freeUnit,
            freeUnitMultiplier: line.freeUnitMultiplier,
            freeQuantity: line.freeQuantity,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
          })),
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return readPurchaseBills();
}
