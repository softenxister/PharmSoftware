import { randomUUID } from "node:crypto";
import { Prisma, PurchaseBillStatus as PrismaPurchaseBillStatus } from "@/generated/prisma/client";
import type { PharmUser } from "@/server/auth/pharmUser";
import { prisma } from "./prisma";
import type {
  CorrectionRequestInput,
  StockAdjustmentInput,
} from "./purchaseCorrectionValidation";
import { normalizeOptionalBatchNo } from "@/lib/batchPresentation";
import { normalizeExpiryDate } from "@/lib/expiryDate";

export type PurchaseCorrectionStatus = "pending" | "approved" | "rejected";

export type SavedPurchaseCorrectionRequest = {
  id: string;
  purchaseBillId: string;
  billNo: string;
  invoiceNo: string;
  distributor: string;
  reason: string;
  status: PurchaseCorrectionStatus;
  requestedBy: string;
  requestedRole: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type CorrectionRow = {
  id: string;
  purchaseBillId: string;
  billNo: string;
  invoiceNo: string;
  distributor: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedRole: string;
  requestedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
};

const savedCorrection = (row: CorrectionRow): SavedPurchaseCorrectionRequest => ({
  id: row.id,
  purchaseBillId: row.purchaseBillId,
  billNo: row.billNo,
  invoiceNo: row.invoiceNo,
  distributor: row.distributor,
  reason: row.reason,
  status: row.status.toLowerCase() as PurchaseCorrectionStatus,
  requestedBy: row.requestedBy,
  requestedRole: row.requestedRole,
  requestedAt: row.requestedAt.toISOString(),
  reviewedBy: row.reviewedBy,
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  reviewNote: row.reviewNote,
});

const correctionSelect = Prisma.sql`
  SELECT
    request."id",
    request."purchaseBillId",
    bill."billNo",
    bill."invoiceNo",
    bill."distributorName" AS "distributor",
    request."reason",
    request."status"::text AS "status",
    request."requestedBy",
    request."requestedRole",
    request."requestedAt",
    request."reviewedBy",
    request."reviewedAt",
    request."reviewNote"
  FROM "PurchaseCorrectionRequest" request
  INNER JOIN "PurchaseBill" bill ON bill."id" = request."purchaseBillId"
`;

export async function readPurchaseCorrectionRequests(
  purchaseBillId?: string,
): Promise<SavedPurchaseCorrectionRequest[]> {
  const rows = purchaseBillId
    ? await prisma.$queryRaw<CorrectionRow[]>(Prisma.sql`
        ${correctionSelect}
        WHERE request."purchaseBillId" = ${purchaseBillId}
        ORDER BY request."requestedAt" DESC
        LIMIT 100
      `)
    : await prisma.$queryRaw<CorrectionRow[]>(Prisma.sql`
        ${correctionSelect}
        ORDER BY
          CASE request."status" WHEN 'PENDING' THEN 0 ELSE 1 END,
          request."requestedAt" DESC
        LIMIT 100
      `);
  return rows.map(savedCorrection);
}

export async function createPurchaseCorrectionRequest(
  input: CorrectionRequestInput,
  requestedBy: PharmUser,
): Promise<SavedPurchaseCorrectionRequest> {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id: input.purchaseBillId },
    select: { status: true },
  });
  if (!bill) throw new Error("Purchase bill was not found.");
  if (bill.status !== PrismaPurchaseBillStatus.RECEIVED) {
    throw new Error("Purchase correction requests are only available after completion.");
  }

  const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PurchaseCorrectionRequest"
    WHERE "purchaseBillId" = ${input.purchaseBillId}
      AND "status" = 'PENDING'
    LIMIT 1
  `);
  if (existing.length > 0) throw new Error("Purchase correction is already pending approval.");

  const id = `purchase-correction-${randomUUID()}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PurchaseCorrectionRequest" (
      "id", "purchaseBillId", "reason", "status", "requestedBy", "requestedRole"
    ) VALUES (
      ${id}, ${input.purchaseBillId}, ${input.reason.trim()}, 'PENDING', ${requestedBy.name}, ${requestedBy.role}
    )
  `);

  const [created] = await readPurchaseCorrectionRequests(input.purchaseBillId);
  if (!created) throw new Error("Purchase correction request could not be created.");
  return created;
}

export async function rejectPurchaseCorrectionRequest(
  requestId: string,
  reviewNote: string,
  reviewer: PharmUser,
): Promise<void> {
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE "PurchaseCorrectionRequest"
    SET
      "status" = 'REJECTED',
      "reviewedBy" = ${reviewer.name},
      "reviewedAt" = CURRENT_TIMESTAMP,
      "reviewNote" = ${reviewNote.trim() || "Rejected by stock manager"}
    WHERE "id" = ${requestId}
      AND "status" = 'PENDING'
  `);
  if (updated === 0) throw new Error("Purchase correction request is no longer pending.");
}

export async function applyStockAdjustment(
  input: StockAdjustmentInput,
  adjustedBy: PharmUser,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.purchaseBill.findUnique({
      where: { id: input.purchaseBillId },
      select: { status: true },
    });
    if (!bill) throw new Error("Purchase bill was not found.");
    if (bill.status !== PrismaPurchaseBillStatus.RECEIVED) {
      throw new Error("Purchase stock can only be adjusted after completion.");
    }

    if (input.correctionRequestId) {
      const requests = await tx.$queryRaw<Array<{ purchaseBillId: string; status: string }>>(Prisma.sql`
        SELECT "purchaseBillId", "status"::text AS "status"
        FROM "PurchaseCorrectionRequest"
        WHERE "id" = ${input.correctionRequestId}
        FOR UPDATE
      `);
      const request = requests[0];
      if (!request || request.purchaseBillId !== input.purchaseBillId || request.status !== "PENDING") {
        throw new Error("Purchase correction request is no longer pending.");
      }
    }

    const adjustmentId = `stock-adjustment-${randomUUID()}`;
    const changedLines: Array<{
      productId: string;
      batchNo: string | null;
      expiryDate: string;
      previousQuantity: number;
      newQuantity: number;
    }> = [];

    for (const line of input.lines) {
      const batchNo = normalizeOptionalBatchNo(line.batchNo);
      const expiryDate = normalizeExpiryDate(line.expiryDate);
      const batches = await tx.$queryRaw<Array<{ availableStock: unknown }>>(Prisma.sql`
        SELECT "availableStock"
        FROM "ProductBatch"
        WHERE "productId" = ${line.productId}
          AND "batchNo" IS NOT DISTINCT FROM ${batchNo}
          AND "expiryDate" = ${expiryDate}
        FOR UPDATE
      `);
      if (!batches[0]) throw new Error("Purchase stock batch was not found.");
      const previousQuantity = Number(batches[0].availableStock);
      if (previousQuantity === line.newQuantity) continue;

      await tx.$executeRaw(Prisma.sql`
        UPDATE "ProductBatch"
        SET "availableStock" = ${line.newQuantity}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "productId" = ${line.productId}
          AND "batchNo" IS NOT DISTINCT FROM ${batchNo}
          AND "expiryDate" = ${expiryDate}
      `);
      changedLines.push({
        productId: line.productId,
        batchNo,
        expiryDate,
        previousQuantity,
        newQuantity: line.newQuantity,
      });
    }
    if (changedLines.length === 0) throw new Error("Purchase stock adjustment has no quantity changes.");

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "StockAdjustment" (
        "id", "purchaseBillId", "correctionRequestId", "reason", "adjustedBy"
      ) VALUES (
        ${adjustmentId}, ${input.purchaseBillId}, ${input.correctionRequestId ?? null}, ${input.reason.trim()}, ${adjustedBy.name}
      )
    `);

    for (const [index, line] of changedLines.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "StockAdjustmentLine" (
          "id", "stockAdjustmentId", "productId", "batchNo", "previousQuantity", "newQuantity", "delta"
        ) VALUES (
          ${`${adjustmentId}-line-${index + 1}`},
          ${adjustmentId},
          ${line.productId},
          ${line.batchNo},
          ${line.previousQuantity},
          ${line.newQuantity},
          ${line.newQuantity - line.previousQuantity}
        )
      `);
    }

    if (input.correctionRequestId) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "PurchaseCorrectionRequest"
        SET
          "status" = 'APPROVED',
          "reviewedBy" = ${adjustedBy.name},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "reviewNote" = ${input.reason.trim()}
        WHERE "id" = ${input.correctionRequestId}
      `);
    }

    return adjustmentId;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
