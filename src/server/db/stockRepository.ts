import { Prisma } from "@/generated/prisma/client";
import type { SalesProduct, StockItemInput } from "./types";
import { prisma } from "./prisma";
import {
  createSavedStockItem,
  relatedLineUpdates,
  savedStockToSalesProduct,
} from "./stockItemMapper";

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

export type SoldStockLineInput = {
  productId: string;
  batchNo: string;
  quantity: number;
  unitMultiplier: number;
};

const productGraph = {
  category: true,
  manufacturer: true,
  parentPacks: { orderBy: { packUnit: "asc" as const } },
  batches: { orderBy: [{ expiryDate: "asc" as const }, { batchNo: "asc" as const }] },
};

type StockProductRow = Prisma.ProductGetPayload<{ include: typeof productGraph }>;

function productRowToSalesProduct(product: StockProductRow): SalesProduct {
  return {
    id: product.id,
    itemName: product.itemName,
    brandName: product.brandName,
    manufacturerName: product.manufacturer.name,
    pack: {
      packUnit: product.packUnit,
      childUnit: product.childUnit,
      childQuantity: Number(product.childQuantity),
      label: product.packLabel,
    },
    parentPacks: product.parentPacks.map((pack) => ({
      packUnit: pack.packUnit,
      childPackUnit: pack.childPackUnit,
      childPackQuantity: Number(pack.childPackQuantity),
      label: pack.label,
      priceMultiplier: Number(pack.priceMultiplier),
    })),
    location: product.location,
    barcode: product.barcode,
    category: product.category.name,
    imageUrl: product.imageUrl,
    weeklySold: product.weeklySold,
    batches: product.batches.map((batch) => ({
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      sellPriceThb: Number(batch.sellPriceThb),
      availableStock: Number(batch.availableStock),
    })),
  };
}

async function upsertStockItem(tx: Prisma.TransactionClient, input: StockItemInput) {
  const barcode = input.barcode.trim();
  const itemName = input.itemName.trim();
  if (!barcode || !itemName) throw new Error("Barcode and item name are required.");

  const current = await tx.product.findUnique({ where: { barcode } });
  const savedItem = createSavedStockItem(input);
  const mapped = savedStockToSalesProduct({
    ...savedItem,
    id: current?.id ?? savedItem.id,
  });
  const [category, manufacturer] = await Promise.all([
    tx.category.upsert({
      where: { name: mapped.category || "Uncategorized" },
      update: {},
      create: { name: mapped.category || "Uncategorized" },
    }),
    tx.manufacturer.upsert({
      where: { name: mapped.manufacturerName || "Unknown manufacturer" },
      update: {},
      create: { name: mapped.manufacturerName || "Unknown manufacturer" },
    }),
  ]);

  await tx.product.upsert({
    where: { id: mapped.id },
    update: {
      isActive: true,
      barcode: mapped.barcode,
      itemName: mapped.itemName,
      brandName: mapped.brandName,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      packUnit: mapped.pack.packUnit,
      childUnit: mapped.pack.childUnit,
      childQuantity: mapped.pack.childQuantity,
      packLabel: mapped.pack.label,
      location: mapped.location,
      imageUrl: mapped.imageUrl,
    },
    create: {
      id: mapped.id,
      barcode: mapped.barcode,
      itemName: mapped.itemName,
      brandName: mapped.brandName,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      packUnit: mapped.pack.packUnit,
      childUnit: mapped.pack.childUnit,
      childQuantity: mapped.pack.childQuantity,
      packLabel: mapped.pack.label,
      location: mapped.location,
      imageUrl: mapped.imageUrl,
      weeklySold: mapped.weeklySold,
    },
  });

  const lineUpdates = relatedLineUpdates(mapped);
  await Promise.all([
    tx.purchaseLine.updateMany(lineUpdates.purchaseLines),
    tx.saleLine.updateMany(lineUpdates.saleLines),
  ]);

  await tx.productParentPack.deleteMany({ where: { productId: mapped.id } });
  if (mapped.parentPacks.length > 0) {
    await tx.productParentPack.createMany({
      data: mapped.parentPacks.map((pack, index) => ({
        productId: mapped.id,
        packUnit: pack.packUnit,
        childPackUnit: pack.childPackUnit,
        childPackQuantity: pack.childPackQuantity,
        label: pack.label,
        priceMultiplier: pack.priceMultiplier,
        barcode: input.packagingRows[index]?.barcode.trim() || null,
      })),
    });
  }

  const batch = mapped.batches[0];
  if (batch) {
    await tx.productBatch.upsert({
      where: { productId_batchNo: { productId: mapped.id, batchNo: batch.batchNo } },
      update: { expiryDate: batch.expiryDate, sellPriceThb: batch.sellPriceThb },
      create: {
        productId: mapped.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        sellPriceThb: batch.sellPriceThb,
        availableStock: batch.availableStock,
      },
    });
  }
}

export async function readStockProducts(): Promise<SalesProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: productGraph,
    orderBy: { itemName: "asc" },
  });
  return products.map(productRowToSalesProduct);
}

export async function saveStockItem(input: StockItemInput): Promise<SalesProduct[]> {
  await prisma.$transaction((tx) => upsertStockItem(tx, input));
  return readStockProducts();
}

export async function saveStockItems(inputs: StockItemInput[]): Promise<SalesProduct[]> {
  await prisma.$transaction(async (tx) => {
    for (const input of inputs) await upsertStockItem(tx, input);
  });
  return readStockProducts();
}

export async function deleteStockItem(productId: string): Promise<SalesProduct[] | null> {
  const result = await prisma.product.updateMany({
    where: { id: productId, isActive: true },
    data: { isActive: false },
  });
  if (result.count === 0) return null;
  return readStockProducts();
}

export async function receivePurchasedStock(
  tx: Prisma.TransactionClient,
  lines: PurchasedStockLineInput[],
): Promise<void> {
  for (const line of lines) {
    const product = await tx.product.findFirst({
      where: {
        OR: [
          { id: line.productId.trim() },
          { barcode: line.barcode.trim() },
        ],
      },
      include: { batches: { orderBy: { expiryDate: "asc" }, take: 1 } },
    });
    if (!product) throw new Error("Purchase item was not found in stock.");

    const purchasedQty = Number(line.quantity) * Number(line.unitMultiplier);
    const freeQty = Number(line.freeQuantity) * Number(line.freeUnitMultiplier);
    const stockQty = purchasedQty + freeQty;
    if (!Number.isFinite(stockQty) || stockQty <= 0) {
      throw new Error(`Purchase quantity is invalid for ${product.itemName}.`);
    }

    const fallbackBatch = product.batches[0];
    const batchNo = line.batchNo.trim()
      || fallbackBatch?.batchNo
      || `PUR-${new Date().toISOString().slice(0, 10)}`;
    await tx.productBatch.upsert({
      where: { productId_batchNo: { productId: product.id, batchNo } },
      update: {
        expiryDate: line.expiryDate.trim() || fallbackBatch?.expiryDate || "",
        availableStock: { increment: stockQty },
      },
      create: {
        productId: product.id,
        batchNo,
        expiryDate: line.expiryDate.trim() || fallbackBatch?.expiryDate || "",
        sellPriceThb: Number(fallbackBatch?.sellPriceThb ?? line.cost) || 0,
        availableStock: stockQty,
      },
    });
  }
}

export async function dispenseSoldStock(
  tx: Prisma.TransactionClient,
  lines: SoldStockLineInput[],
): Promise<void> {
  for (const line of lines) {
    const product = await tx.product.findUnique({ where: { id: line.productId.trim() } });
    if (!product) throw new Error("Sale item was not found in stock.");

    const soldQty = Number(line.quantity) * Number(line.unitMultiplier);
    if (!Number.isFinite(soldQty) || soldQty <= 0) {
      throw new Error("Sale item quantity is invalid.");
    }

    const result = await tx.productBatch.updateMany({
      where: {
        productId: product.id,
        batchNo: line.batchNo.trim(),
        availableStock: { gte: soldQty },
      },
      data: { availableStock: { decrement: soldQty } },
    });

    if (result.count === 0) {
      const batch = await tx.productBatch.findUnique({
        where: { productId_batchNo: { productId: product.id, batchNo: line.batchNo.trim() } },
      });
      if (!batch) throw new Error(`Batch ${line.batchNo} was not found in stock.`);
      throw new Error(`Insufficient stock for ${product.itemName}.`);
    }
  }
}
