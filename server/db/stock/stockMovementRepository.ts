import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { normalizeExpiryDate } from "@/lib/expiryDate";

export type PurchasedStockLineInput = {
  productId: string;
  barcode: string;
  batchNo: string | null;
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
  expiryDate: string;
  quantity: number;
  unitMultiplier: number;
};

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
    const batchNo = normalizeOptionalBatchNo(line.batchNo);
    const expiryDate = normalizeExpiryDate(line.expiryDate);
    if (!expiryDate) throw new Error(`Expiry date is required for ${product.itemName}.`);

    const sellPriceThb = Number(fallbackBatch?.sellPriceThb ?? line.cost) || 0;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductBatch" (
        "id", "productId", "batchNo", "expiryDate", "sellPriceThb", "availableStock"
      ) VALUES (
        ${`product-batch-${randomUUID()}`},
        ${product.id},
        ${batchNo},
        ${expiryDate},
        ${sellPriceThb},
        ${stockQty}
      )
      ON CONFLICT ("productId", "batchNo", "expiryDate")
      DO UPDATE SET
        "availableStock" = "ProductBatch"."availableStock" + EXCLUDED."availableStock",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
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

    const batchNo = normalizeOptionalBatchNo(line.batchNo);
    const expiryDate = normalizeExpiryDate(line.expiryDate);
    const result = await tx.productBatch.updateMany({
      where: {
        productId: product.id,
        batchNo,
        expiryDate,
        availableStock: { gte: soldQty },
      },
      data: { availableStock: { decrement: soldQty } },
    });

    if (result.count === 0) {
      const batch = await tx.productBatch.findFirst({
        where: {
          productId: product.id,
          batchNo,
          expiryDate,
        },
      });
      if (!batch) throw new Error(`Batch ${batchNo ?? "-"} was not found in stock.`);
      throw new Error(`Insufficient stock for ${product.itemName}.`);
    }
  }
}
