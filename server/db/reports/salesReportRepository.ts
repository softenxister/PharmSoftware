import { DiscountType, Prisma, SaleStatus } from "@server/generated/prisma/client";
import { calculateInclusiveVat, parseReceiptSnapshot } from "@/lib/receipt";
import { prisma } from "../core/prisma";
import {
  buildSalesReport,
  salesReportDateBounds,
  type SalesReportQuery,
  type SalesReportResponse,
  type SalesReportSourceLine,
  type SalesReportSourceSale,
} from "./salesReportModel";

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type ReportSaleRecord = Awaited<ReturnType<typeof readPaidSales>>[number];

type DatabaseCostSnapshot = {
  unitCost: number;
};

function legacyBillDiscount(record: ReportSaleRecord): number {
  if (!record.discountType) return 0;
  const value = Number(record.discountValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (record.discountType === DiscountType.THB) return roundCurrency(value);
  if (value >= 100) return 0;
  return roundCurrency((Number(record.netTotal) * value) / (100 - value));
}

function fallbackLines(
  record: ReportSaleRecord,
  itemSubtotal: number,
  databaseCosts: ReadonlyMap<string, DatabaseCostSnapshot>,
): SalesReportSourceLine[] {
  const grouped = new Map<string, {
    productId: string;
    productCode: string;
    itemName: string;
    packLabel: string;
    quantity: number;
    grossValue: number;
    unitCost: number | null;
  }>();
  for (const line of record.lines) {
    const key = `${line.productId}\u0000${line.packLabel}\u0000${Number(line.unitPriceThb ?? 0)}`;
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPriceThb ?? Number(line.sellPriceThb) * Number(line.packMultiplier));
    const databaseCost = databaseCosts.get(line.id)?.unitCost ?? null;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.grossValue += quantity * unitPrice;
      if (existing.unitCost === null || databaseCost === null
        || existing.unitCost !== databaseCost) {
        existing.unitCost = null;
      }
    } else {
      grouped.set(key, {
        productId: line.productId,
        productCode: line.product.externalProductCode ?? line.productId,
        itemName: line.itemName,
        packLabel: line.packLabel,
        quantity,
        grossValue: quantity * unitPrice,
        unitCost: databaseCost,
      });
    }
  }
  const values = [...grouped.values()];
  const grossTotal = values.reduce((sum, line) => sum + line.grossValue, 0);
  let allocated = 0;
  return values.map((line, index) => {
    const productSales = index === values.length - 1
      ? roundCurrency(itemSubtotal - allocated)
      : grossTotal > 0 ? roundCurrency(itemSubtotal * (line.grossValue / grossTotal)) : 0;
    allocated = roundCurrency(allocated + productSales);
    return {
      productId: line.productId,
      productCode: line.productCode,
      itemName: line.itemName,
      packLabel: line.packLabel,
      quantity: line.quantity,
      productSales,
      unitCost: line.unitCost,
      costSource: line.unitCost === null ? "unavailable" : "historical-database",
    };
  });
}

function snapshotLines(
  record: ReportSaleRecord,
  snapshot: NonNullable<ReturnType<typeof parseReceiptSnapshot>>,
  databaseCosts: ReadonlyMap<string, DatabaseCostSnapshot>,
): SalesReportSourceLine[] {
  return snapshot.lines.map((line, index) => {
    const persistedLine = line.productId
      ? record.lines.find((candidate) => candidate.productId === line.productId
        && (!line.packLabel || candidate.packLabel === line.packLabel))
      : record.lines[index];
    const databaseCost = persistedLine ? databaseCosts.get(persistedLine.id) : undefined;
    const unitCost = line.unitCost ?? databaseCost?.unitCost ?? null;
    return {
      productId: line.productId ?? persistedLine?.productId ?? `legacy-${record.id}-${index}`,
      productCode: persistedLine?.product.externalProductCode ?? line.productId ?? "—",
      itemName: line.itemName,
      packLabel: line.packLabel ?? persistedLine?.packLabel ?? "—",
      quantity: line.quantity,
      productSales: line.lineTotal,
      unitCost,
      costSource: line.unitCost !== undefined
        ? "snapshot"
        : databaseCost ? "historical-database" : "unavailable",
    };
  });
}

export function mapSaleToReportSource(
  record: ReportSaleRecord,
  databaseCosts: ReadonlyMap<string, DatabaseCostSnapshot> = new Map(),
): SalesReportSourceSale {
  const snapshot = parseReceiptSnapshot(record.receiptSnapshot);
  if (snapshot) {
    return {
      id: record.id,
      billNo: record.billNo,
      soldAt: record.soldAt.toISOString(),
      customerName: record.customerName,
      paymentMethod: record.paymentMethod,
      status: "paid",
      itemSubtotal: snapshot.itemSubtotal,
      billDiscountAmount: snapshot.billDiscountAmount,
      netCollected: snapshot.netTotal,
      vatAmount: snapshot.vat.vatAmount,
      lines: snapshotLines(record, snapshot, databaseCosts),
    };
  }

  const netCollected = Number(record.netTotal);
  const billDiscountAmount = legacyBillDiscount(record);
  const itemSubtotal = roundCurrency(netCollected + billDiscountAmount);
  return {
    id: record.id,
    billNo: record.billNo,
    soldAt: record.soldAt.toISOString(),
    customerName: record.customerName,
    paymentMethod: record.paymentMethod,
    status: "paid",
    itemSubtotal,
    billDiscountAmount,
    netCollected,
    vatAmount: calculateInclusiveVat(netCollected).vatAmount,
    lines: fallbackLines(record, itemSubtotal, databaseCosts),
  };
}

async function readPaidSales(query: SalesReportQuery) {
  const bounds = salesReportDateBounds(query);
  return prisma.sale.findMany({
    where: {
      status: SaleStatus.PAID,
      soldAt: { gte: bounds.start, lt: bounds.endExclusive },
    },
    select: {
      id: true,
      billNo: true,
      soldAt: true,
      customerName: true,
      paymentMethod: true,
      netTotal: true,
      discountType: true,
      discountValue: true,
      receiptSnapshot: true,
      lines: {
        select: {
          id: true,
          productId: true,
          itemName: true,
          packLabel: true,
          packMultiplier: true,
          sellPriceThb: true,
          unitPriceThb: true,
          quantity: true,
          position: true,
          product: { select: { externalProductCode: true } },
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
  });
}

async function readDatabaseCostSnapshots(
  records: ReportSaleRecord[],
): Promise<ReadonlyMap<string, DatabaseCostSnapshot>> {
  const saleLineIds = records.flatMap((record) => record.lines.map((line) => line.id));
  if (saleLineIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{
    saleLineId: string;
    baseUnitCost: unknown;
    packMultiplier: unknown;
  }>>(Prisma.sql`
    SELECT
      sale_line.id AS "saleLineId",
      COALESCE(latest."unitCost", product."migrationCostThb") AS "baseUnitCost",
      sale_line."packMultiplier"
    FROM "SaleLine" sale_line
    INNER JOIN "Sale" sale ON sale.id = sale_line."saleId"
    INNER JOIN "Product" product ON product.id = sale_line."productId"
    LEFT JOIN LATERAL (
      SELECT purchase_line.cost / NULLIF(purchase_line."unitMultiplier", 0) AS "unitCost"
      FROM "PurchaseLine" purchase_line
      INNER JOIN "PurchaseBill" purchase_bill ON purchase_bill.id = purchase_line."purchaseBillId"
      WHERE purchase_line."productId" = sale_line."productId"
        AND purchase_bill.status = 'RECEIVED'
        AND purchase_bill."purchasedAt" <= sale."soldAt"
        AND purchase_line.cost > 0
        AND purchase_line."unitMultiplier" > 0
      ORDER BY purchase_bill."purchasedAt" DESC, purchase_bill."createdAt" DESC, purchase_line.id DESC
      LIMIT 1
    ) latest ON true
    WHERE sale_line.id IN (${Prisma.join(saleLineIds)})
      AND COALESCE(latest."unitCost", product."migrationCostThb") > 0
  `);
  const costs = new Map<string, DatabaseCostSnapshot>();
  for (const row of rows) {
    const unitCost = Number(row.baseUnitCost) * Number(row.packMultiplier);
    if (!Number.isFinite(unitCost) || unitCost <= 0) continue;
    costs.set(row.saleLineId, { unitCost: roundCurrency(unitCost) });
  }
  return costs;
}

export async function readSalesReport(
  query: SalesReportQuery,
  canViewProfit: boolean,
): Promise<SalesReportResponse> {
  const records = await readPaidSales(query);
  const databaseCosts = canViewProfit
    ? await readDatabaseCostSnapshots(records)
    : new Map<string, DatabaseCostSnapshot>();
  return buildSalesReport(
    records.map((record) => mapSaleToReportSource(record, databaseCosts)),
    query,
    canViewProfit,
  );
}
