import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { DirectStockAdjustmentInput } from "@/lib/directStockAdjustment";
import type { PharmUser } from "@/server/auth/pharmUser";
import { prisma } from "./prisma";

const DIRECT_ADJUSTMENT_AUDIT_REASON = "Direct stock quantity adjustment";

export async function applyDirectStockAdjustment(
  input: DirectStockAdjustmentInput,
  adjustedBy: PharmUser,
): Promise<{
  adjustmentId: string;
  productId: string;
  quantities: Array<{ batchNo: string; availableStock: number }>;
}> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId.trim(), isActive: true },
      select: { id: true },
    });
    if (!product) throw new Error("Stock item was not found.");

    const adjustmentId = `stock-adjustment-${randomUUID()}`;
    const changedLines: Array<{
      batchNo: string;
      previousQuantity: number;
      newQuantity: number;
    }> = [];

    for (const line of input.lines) {
      const batchNo = line.batchNo.trim();
      const batches = await tx.$queryRaw<Array<{ availableStock: unknown }>>(Prisma.sql`
        SELECT "availableStock"
        FROM "ProductBatch"
        WHERE "productId" = ${product.id}
          AND "batchNo" = ${batchNo}
        FOR UPDATE
      `);
      if (!batches[0]) throw new Error(`Batch ${batchNo} was not found for this stock item.`);

      const previousQuantity = Number(batches[0].availableStock);
      if (previousQuantity === line.newQuantity) continue;
      await tx.productBatch.update({
        where: { productId_batchNo: { productId: product.id, batchNo } },
        data: { availableStock: line.newQuantity },
      });
      changedLines.push({ batchNo, previousQuantity, newQuantity: line.newQuantity });
    }

    if (changedLines.length === 0) throw new Error("Stock adjustment has no quantity changes.");

    await tx.stockAdjustment.create({
      data: {
        id: adjustmentId,
        reason: DIRECT_ADJUSTMENT_AUDIT_REASON,
        adjustedBy: adjustedBy.name,
        lines: {
          create: changedLines.map((line, index) => ({
            id: `${adjustmentId}-line-${index + 1}`,
            productId: product.id,
            batchNo: line.batchNo,
            previousQuantity: line.previousQuantity,
            newQuantity: line.newQuantity,
            delta: line.newQuantity - line.previousQuantity,
          })),
        },
      },
    });

    return {
      adjustmentId,
      productId: product.id,
      quantities: changedLines.map((line) => ({
        batchNo: line.batchNo,
        availableStock: line.newQuantity,
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
