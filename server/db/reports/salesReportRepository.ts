import { DiscountType, SaleStatus } from "@server/generated/prisma/client";
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

function legacyBillDiscount(record: ReportSaleRecord): number {
  if (!record.discountType) return 0;
  const value = Number(record.discountValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (record.discountType === DiscountType.THB) return roundCurrency(value);
  if (value >= 100) return 0;
  return roundCurrency((Number(record.netTotal) * value) / (100 - value));
}

function fallbackLines(record: ReportSaleRecord, itemSubtotal: number): SalesReportSourceLine[] {
  const grouped = new Map<string, {
    productId: string;
    productCode: string;
    itemName: string;
    packLabel: string;
    quantity: number;
    grossValue: number;
  }>();
  for (const line of record.lines) {
    const key = `${line.productId}\u0000${line.packLabel}\u0000${Number(line.unitPriceThb ?? 0)}`;
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPriceThb ?? Number(line.sellPriceThb) * Number(line.packMultiplier));
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.grossValue += quantity * unitPrice;
    } else {
      grouped.set(key, {
        productId: line.productId,
        productCode: line.product.externalProductCode ?? line.productId,
        itemName: line.itemName,
        packLabel: line.packLabel,
        quantity,
        grossValue: quantity * unitPrice,
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
      unitCost: null,
      costSource: "unavailable",
    };
  });
}

function snapshotLines(record: ReportSaleRecord, snapshot: NonNullable<ReturnType<typeof parseReceiptSnapshot>>): SalesReportSourceLine[] {
  return snapshot.lines.map((line, index) => {
    const persistedLine = line.productId
      ? record.lines.find((candidate) => candidate.productId === line.productId
        && (!line.packLabel || candidate.packLabel === line.packLabel))
      : record.lines[index];
    return {
      productId: line.productId ?? persistedLine?.productId ?? `legacy-${record.id}-${index}`,
      productCode: persistedLine?.product.externalProductCode ?? line.productId ?? "—",
      itemName: line.itemName,
      packLabel: line.packLabel ?? persistedLine?.packLabel ?? "—",
      quantity: line.quantity,
      productSales: line.lineTotal,
      unitCost: line.unitCost ?? null,
      costSource: line.unitCost === undefined ? "unavailable" : "snapshot",
    };
  });
}

function toSourceSale(record: ReportSaleRecord): SalesReportSourceSale {
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
      lines: snapshotLines(record, snapshot),
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
    lines: fallbackLines(record, itemSubtotal),
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

export async function readSalesReport(
  query: SalesReportQuery,
  canViewProfit: boolean,
): Promise<SalesReportResponse> {
  const records = await readPaidSales(query);
  return buildSalesReport(records.map(toSourceSale), query, canViewProfit);
}
