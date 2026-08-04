import { randomUUID } from "node:crypto";
import { Prisma } from "@server/generated/prisma/client";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  prepareCustomerPurchaseHistoryMigration,
  type CustomerPurchaseHistoryMigrationRow,
  type CustomerPurchaseHistoryPreview,
  type ExistingPurchaseHistoryCustomer,
  type ExistingPurchaseHistoryProduct,
} from "@server/import/customerPurchaseHistoryMigration";
import { readFirstXlsxWorksheet } from "@server/import/xlsxWorksheet";
import {
  BAHT_PER_MEMBERSHIP_POINT,
  MEMBERSHIP_RANK_POINT_LIMITS,
} from "@/lib/membershipRank";
import { prisma } from "../core/prisma";

type PurchaseHistoryReadClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export type CustomerPurchaseHistoryWrite = {
  id: string;
  customerId: string;
  productId: string;
  customerCode: string;
  externalProductCode: string;
  sourceItemName: string;
  unit: string;
  quantity: number;
  totalAmount: number;
  reportStartedAt: Date | null;
  reportEndedAt: Date | null;
  sourceFileName: string;
  sourceFileHash: string;
  sourceRow: number;
  customerRow: number;
  importedBy: string;
};

export type CustomerPurchaseHistoryImportResult = {
  migrationId: string;
  importedCount: number;
  skippedDuplicateCount: number;
  skippedUnmatchedCustomerCount: number;
  skippedUnmatchedProductCount: number;
  skippedConflictCount: number;
};

export class CustomerPurchaseHistoryConfirmationError extends Error {}

const PURCHASE_HISTORY_IMPORT_BATCH_SIZE = 500;

export const CUSTOMER_PURCHASE_HISTORY_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

export function buildCustomerPurchaseHistoryWrite(
  row: CustomerPurchaseHistoryMigrationRow,
  metadata: {
    id: string;
    fileName: string;
    fileHash: string;
    reportStartedAt: Date | null;
    reportEndedAt: Date | null;
    importedBy: string;
  },
): CustomerPurchaseHistoryWrite {
  if (row.status !== "matched" || !row.matchedCustomerId || !row.matchedProductId) {
    throw new Error("Purchase history rows require a matched customer and product.");
  }
  return {
    id: metadata.id,
    customerId: row.matchedCustomerId,
    productId: row.matchedProductId,
    customerCode: row.customerCode,
    externalProductCode: row.externalProductCode,
    sourceItemName: row.sourceItemName,
    unit: row.unit,
    quantity: row.quantity,
    totalAmount: row.totalAmount,
    reportStartedAt: metadata.reportStartedAt,
    reportEndedAt: metadata.reportEndedAt,
    sourceFileName: metadata.fileName,
    sourceFileHash: metadata.fileHash,
    sourceRow: row.rowNumber,
    customerRow: row.customerRowNumber,
    importedBy: metadata.importedBy,
  };
}

async function readExistingCustomers(
  client: PurchaseHistoryReadClient = prisma,
): Promise<ExistingPurchaseHistoryCustomer[]> {
  return client.$queryRaw(Prisma.sql`
    SELECT id, "memberCode", name
    FROM "Customer"
    WHERE "isMember" = true AND "memberCode" IS NOT NULL
  `);
}

async function readExistingProducts(
  client: PurchaseHistoryReadClient = prisma,
): Promise<ExistingPurchaseHistoryProduct[]> {
  return client.$queryRaw(Prisma.sql`
    SELECT id, "externalProductCode", "itemName"
    FROM "Product"
    WHERE "externalProductCode" IS NOT NULL
  `);
}

async function readDuplicateSourceRows(
  sourceFileHash: string,
  client: PurchaseHistoryReadClient = prisma,
): Promise<Set<number>> {
  const rows = await client.$queryRaw<Array<{ sourceRow: number }>>(Prisma.sql`
    SELECT "sourceRow"
    FROM "CustomerPurchaseHistoryImport"
    WHERE "sourceFileHash" = ${sourceFileHash}
  `);
  return new Set(rows.map(({ sourceRow }) => sourceRow));
}

async function preparedMigration(
  fileName: string,
  bytes: Uint8Array,
  client: PurchaseHistoryReadClient = prisma,
) {
  const [existingCustomers, existingProducts] = await Promise.all([
    readExistingCustomers(client),
    readExistingProducts(client),
  ]);
  const worksheetRows = readFirstXlsxWorksheet(bytes);
  const firstPass = prepareCustomerPurchaseHistoryMigration({
    fileName,
    fileBytes: bytes,
    worksheetRows,
    existingCustomers,
    existingProducts,
  });
  const duplicateSourceRows = await readDuplicateSourceRows(firstPass.preview.sourceFileHash, client);
  return prepareCustomerPurchaseHistoryMigration({
    fileName,
    fileBytes: bytes,
    worksheetRows,
    existingCustomers,
    existingProducts,
    duplicateSourceRows,
  });
}

export async function previewCustomerPurchaseHistoryMigration(
  fileName: string,
  bytes: Uint8Array,
): Promise<CustomerPurchaseHistoryPreview> {
  return (await preparedMigration(fileName, bytes)).preview;
}

async function insertPurchaseHistoryRows(
  tx: Prisma.TransactionClient,
  writes: readonly CustomerPurchaseHistoryWrite[],
): Promise<number> {
  let insertedCount = 0;
  for (let index = 0; index < writes.length; index += PURCHASE_HISTORY_IMPORT_BATCH_SIZE) {
    const batch = writes.slice(index, index + PURCHASE_HISTORY_IMPORT_BATCH_SIZE);
    const values = batch.map((write) => Prisma.sql`(
      ${write.id}, ${write.customerId}, ${write.productId}, ${write.customerCode},
      ${write.externalProductCode}, ${write.sourceItemName}, ${write.unit},
      ${write.quantity}, ${write.totalAmount}, ${write.reportStartedAt},
      ${write.reportEndedAt}, ${write.sourceFileName}, ${write.sourceFileHash},
      ${write.sourceRow}, ${write.customerRow}, ${write.importedBy}, CURRENT_TIMESTAMP
    )`);
    insertedCount += await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CustomerPurchaseHistoryImport" (
        id, "customerId", "productId", "customerCode", "externalProductCode",
        "sourceItemName", unit, quantity, "totalAmount", "reportStartedAt",
        "reportEndedAt", "sourceFileName", "sourceFileHash", "sourceRow",
        "customerRow", "importedBy", "createdAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("sourceFileHash", "sourceRow") DO NOTHING
    `);
  }
  return insertedCount;
}

async function recalculateAllMemberLoyalty(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    WITH paid_purchase_totals AS (
      SELECT
        s."customerId",
        SUM(s."netTotal") AS "totalPurchase"
      FROM "Sale" s
      WHERE s.status = 'PAID' AND s."customerId" IS NOT NULL
      GROUP BY s."customerId"
    ),
    imported_purchase_totals AS (
      SELECT
        chi."customerId",
        SUM(chi."totalAmount") AS "totalPurchase"
      FROM "CustomerPurchaseHistoryImport" chi
      GROUP BY chi."customerId"
    ),
    lifetime_loyalty AS (
      SELECT
        c.id,
        FLOOR(
          GREATEST(
            COALESCE(ppt."totalPurchase", 0)
              + COALESCE(ipt."totalPurchase", 0),
            0
          ) / ${BAHT_PER_MEMBERSHIP_POINT}
        )::integer AS points
      FROM "Customer" c
      LEFT JOIN paid_purchase_totals ppt ON ppt."customerId" = c.id
      LEFT JOIN imported_purchase_totals ipt ON ipt."customerId" = c.id
      WHERE c."isMember" = true
    )
    UPDATE "Customer" c
    SET
      points = ll.points,
      "membershipRank" = CASE
        WHEN ll.points <= ${MEMBERSHIP_RANK_POINT_LIMITS.bronze} THEN 'Bronze'
        WHEN ll.points <= ${MEMBERSHIP_RANK_POINT_LIMITS.silver} THEN 'Silver'
        WHEN ll.points <= ${MEMBERSHIP_RANK_POINT_LIMITS.gold} THEN 'Gold'
        WHEN ll.points <= ${MEMBERSHIP_RANK_POINT_LIMITS.platinum} THEN 'Platinum'
        ELSE 'Diamond'
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM lifetime_loyalty ll
    WHERE c.id = ll.id
  `);
}

export async function importCustomerPurchaseHistoryMigration(
  fileName: string,
  bytes: Uint8Array,
  confirmationToken: string,
  user: Pick<PharmUser, "id" | "name">,
): Promise<CustomerPurchaseHistoryImportResult> {
  return prisma.$transaction(async (tx) => {
    const prepared = await preparedMigration(fileName, bytes, tx);
    if (prepared.preview.confirmationToken !== confirmationToken) {
      throw new CustomerPurchaseHistoryConfirmationError(
        "The selected report or customer/product matching changed after preview. Preview it again before importing.",
      );
    }
    if (prepared.importRows.length === 0) {
      throw new CustomerPurchaseHistoryConfirmationError(
        "No matched purchase-history rows remain to import.",
      );
    }

    const writes = prepared.importRows.map((row) => buildCustomerPurchaseHistoryWrite(row, {
      id: `customer-purchase-history-${randomUUID()}`,
      fileName: fileName.slice(0, 255),
      fileHash: prepared.preview.sourceFileHash,
      reportStartedAt: prepared.reportPeriod.startedAt,
      reportEndedAt: prepared.reportPeriod.endedAt,
      importedBy: user.name || user.id,
    }));
    const importedCount = await insertPurchaseHistoryRows(tx, writes);
    await recalculateAllMemberLoyalty(tx);

    return {
      migrationId: `customer-purchase-migration-${randomUUID()}`,
      importedCount,
      skippedDuplicateCount: prepared.preview.summary.duplicateCount + writes.length - importedCount,
      skippedUnmatchedCustomerCount: prepared.preview.summary.unmatchedCustomerCount,
      skippedUnmatchedProductCount: prepared.preview.summary.unmatchedProductCount,
      skippedConflictCount: prepared.preview.summary.conflictCount,
    };
  }, CUSTOMER_PURCHASE_HISTORY_TRANSACTION_OPTIONS);
}
