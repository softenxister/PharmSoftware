import { Prisma, PurchaseBillStatus as PrismaPurchaseBillStatus } from "@server/generated/prisma/client";
import { prisma } from "./prisma";
import {
  receivePurchasedStock,
  type PurchasedStockLineInput,
} from "./stockRepository";
import { canTransitionPurchaseStatus } from "@/lib/purchaseWorkflow";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { normalizeExpiryDate } from "@/lib/expiryDate";

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
  id?: string;
  invoiceNo?: string;
  distributor?: string;
  totalQty?: number;
  netTotal?: number;
  status?: PurchaseBillStatus;
  lines?: SavedPurchaseLine[];
};

export type SavePurchaseBillResult = {
  bill: SavedPurchaseBill;
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

function purchaseLinesToSavedLines(lines: PurchaseBillRow["lines"]): SavedPurchaseLine[] {
  return lines.map((line) => ({
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
    batchNo: normalizeOptionalBatchNo(line.batchNo),
    expiryDate: normalizeExpiryDate(line.expiryDate),
  }));
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
    lines: purchaseLinesToSavedLines(bill.lines),
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

export async function readPurchaseBill(id: string): Promise<SavedPurchaseBill | null> {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id },
    include: purchaseBillGraph,
  });
  return bill ? purchaseBillRowToSavedBill(bill) : null;
}

export async function readDistributorNames(): Promise<string[]> {
  const distributors = await prisma.distributor.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return distributors.map((distributor) => distributor.name);
}

export async function savePurchaseBill(input: PurchaseBillInput): Promise<SavePurchaseBillResult> {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length === 0) throw new Error("A purchase bill requires at least one item.");

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10).replace(/-/g, "");
  const billPrefix = `PB-${dayKey}-`;
  const distributorName = input.distributor?.trim() || "Unknown distributor";
  const totalQty = Number(input.totalQty);
  const netTotal = Number(input.netTotal);
  if (!Number.isFinite(totalQty) || totalQty <= 0 || !Number.isFinite(netTotal) || netTotal <= 0) {
    throw new Error("Purchase totals are invalid.");
  }

  const status = input.status ?? "received";
  const prismaStatus = status === "draft"
    ? PrismaPurchaseBillStatus.DRAFT
    : status === "partial"
      ? PrismaPurchaseBillStatus.PARTIAL
      : PrismaPurchaseBillStatus.RECEIVED;
  if (!input.id && status === "received") {
    throw new Error("Purchase bill must be prepared before completion.");
  }

  let savedBillId = input.id ?? "";

  await prisma.$transaction(async (tx) => {
    const lineData = (purchaseBillId: string) => lines.map((line) => ({
      id: line.id,
      purchaseBillId,
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
      batchNo: normalizeOptionalBatchNo(line.batchNo),
      expiryDate: normalizeExpiryDate(line.expiryDate),
    }));

    if (input.id) {
      const existingBill = await tx.purchaseBill.findUnique({
        where: { id: input.id },
        include: purchaseBillGraph,
      });
      if (!existingBill) throw new Error("Purchase bill was not found.");
      if (existingBill.status === PrismaPurchaseBillStatus.RECEIVED) {
        throw new Error("Purchase bill was already received and cannot be edited.");
      }
      const existingStatus = savedStatus(existingBill.status);
      const isEditableDraftSave = existingStatus === "draft" && status === "draft";
      if (!isEditableDraftSave && !canTransitionPurchaseStatus(existingStatus, status)) {
        throw new Error("Purchase bill status transition is invalid.");
      }

      if (prismaStatus === PrismaPurchaseBillStatus.RECEIVED) {
        await receivePurchasedStock(tx, purchaseLinesToSavedLines(existingBill.lines));
        await tx.purchaseBill.update({
          where: { id: input.id },
          data: { status: PrismaPurchaseBillStatus.RECEIVED },
        });
        return;
      }

      const distributor = await tx.distributor.upsert({
        where: { name: distributorName },
        update: {},
        create: { name: distributorName },
      });
      await tx.purchaseLine.deleteMany({ where: { purchaseBillId: input.id } });
      await tx.purchaseBill.update({
        where: { id: input.id },
        data: {
          invoiceNo: input.invoiceNo?.trim() || "Manual",
          distributorId: distributor.id,
          distributorName,
          itemCount: lines.length,
          totalQty,
          netTotal,
          status: prismaStatus,
        },
      });
      await tx.purchaseLine.createMany({ data: lineData(input.id) });
      return;
    }

    const [billCount, distributor] = await Promise.all([
      tx.purchaseBill.count({ where: { billNo: { startsWith: billPrefix } } }),
      tx.distributor.upsert({
        where: { name: distributorName },
        update: {},
        create: { name: distributorName },
      }),
    ]);
    const billNo = `${billPrefix}${String(billCount + 1).padStart(3, "0")}`;
    const purchaseBillId = `purchase-${now.getTime()}`;
    savedBillId = purchaseBillId;

    if (prismaStatus === PrismaPurchaseBillStatus.RECEIVED) {
      await receivePurchasedStock(tx, lines);
    }
    await tx.purchaseBill.create({
      data: {
        id: purchaseBillId,
        billNo,
        invoiceNo: input.invoiceNo?.trim() || "Manual",
        purchasedAt: now,
        distributorId: distributor.id,
        distributorName,
        itemCount: lines.length,
        totalQty,
        netTotal,
        status: prismaStatus,
      },
    });
    await tx.purchaseLine.createMany({ data: lineData(purchaseBillId) });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const bill = await readPurchaseBill(savedBillId);
  if (!bill) throw new Error("Purchase bill could not be reloaded after saving.");
  return { bill };
}
