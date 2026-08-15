import { Prisma, PurchaseBillStatus, SaleStatus } from "@server/generated/prisma/client";
import { readSalesReport } from "../reports/salesReportRepository";
import { readStoreProfile } from "../settings/storeProfileRepository";
import { prisma } from "../core/prisma";
import { stockTotalsCte, totalStockSql } from "../stock/stockInventoryMetadata";
import {
  bangkokHour,
  buildDashboardPeriod,
  buildHourlySales,
  buildTimelineHours,
  comparisonPercent,
  storeIsOpen,
  summarizeDashboardSales,
  type DashboardHourlyTotal,
  type DashboardInventoryAlert,
  type DashboardResponse,
} from "./dashboardModel";

type HourlyRow = {
  period: "today" | "yesterday";
  hour: number;
  total: unknown;
};

type InventoryCountRow = {
  outOfStock: number;
  lowStock: number;
  expiringWithin30Days: number;
};

type InventoryAlertRow = {
  productId: string;
  name: string;
  reason: DashboardInventoryAlert["reason"];
  availableStock: unknown;
  expiryDate: string;
  imageUrl: string;
};

type PurchaseTotalRow = {
  total: unknown;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

async function readSalesSummary(start: Date, end: Date) {
  const rows = await prisma.sale.findMany({
    where: {
      status: SaleStatus.PAID,
      soldAt: { gte: start, lt: end },
    },
    select: { netTotal: true, isMember: true },
  });
  return summarizeDashboardSales(rows.map((sale) => ({
    netTotal: Number(sale.netTotal),
    isMember: sale.isMember,
  })));
}

export function dashboardPurchaseTotalSql(start: Date, end: Date) {
  return Prisma.sql`
    SELECT COALESCE(SUM(purchase_bill."netTotal"), 0) AS total
    FROM "PurchaseBill" purchase_bill
    WHERE purchase_bill.status = ${PurchaseBillStatus.RECEIVED}::"PurchaseBillStatus"
      AND purchase_bill."purchasedAt" >= ${start}
      AND purchase_bill."purchasedAt" < ${end}
  `;
}

async function readPurchaseTotal(start: Date, end: Date) {
  const [row] = await prisma.$queryRaw<PurchaseTotalRow[]>(
    dashboardPurchaseTotalSql(start, end),
  );
  return roundCurrency(Number(row?.total ?? 0));
}

async function readHourlyTotals(
  todayStart: Date,
  todayEnd: Date,
  yesterdayStart: Date,
  yesterdayEnd: Date,
) {
  const rows = await prisma.$queryRaw<HourlyRow[]>(dashboardHourlySalesSql(
    todayStart,
    todayEnd,
    yesterdayStart,
    yesterdayEnd,
  ));
  const project = (period: HourlyRow["period"]): DashboardHourlyTotal[] => rows
    .filter((row) => row.period === period)
    .map((row) => ({ hour: Number(row.hour), total: Number(row.total) }));
  return { today: project("today"), yesterday: project("yesterday") };
}

export function dashboardHourlySalesSql(
  todayStart: Date,
  todayEnd: Date,
  yesterdayStart: Date,
  yesterdayEnd: Date,
) {
  return Prisma.sql`
    SELECT
      'today'::text AS period,
      EXTRACT(
        HOUR FROM sale."soldAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok'
      )::integer AS hour,
      SUM(sale."netTotal") AS total
    FROM "Sale" sale
    WHERE sale.status = ${SaleStatus.PAID}::"SaleStatus"
      AND sale."soldAt" >= ${todayStart}
      AND sale."soldAt" < ${todayEnd}
    GROUP BY hour
    UNION ALL
    SELECT
      'yesterday'::text AS period,
      EXTRACT(
        HOUR FROM sale."soldAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok'
      )::integer AS hour,
      SUM(sale."netTotal") AS total
    FROM "Sale" sale
    WHERE sale.status = ${SaleStatus.PAID}::"SaleStatus"
      AND sale."soldAt" >= ${yesterdayStart}
      AND sale."soldAt" < ${yesterdayEnd}
    GROUP BY hour
  `;
}

async function readInventorySnapshot(date: string) {
  const [counts] = await prisma.$queryRaw<InventoryCountRow[]>(Prisma.sql`
    WITH ${stockTotalsCte}
    SELECT
      COUNT(*) FILTER (WHERE ${totalStockSql} <= 0)::integer AS "outOfStock",
      COUNT(*) FILTER (
        WHERE ${totalStockSql} > 0 AND ${totalStockSql} < product."minimumStock"
      )::integer AS "lowStock",
      COUNT(*) FILTER (
        WHERE stock_totals."nearestExpiry" BETWEEN ${date}::date AND ${date}::date + 30
      )::integer AS "expiringWithin30Days"
    FROM "Product" product
    LEFT JOIN stock_totals ON stock_totals."productId" = product.id
    WHERE product."isActive" = TRUE
  `);

  const items = await prisma.$queryRaw<InventoryAlertRow[]>(Prisma.sql`
    WITH ${stockTotalsCte}
    SELECT
      product.id AS "productId",
      product."itemName" AS name,
      'expired'::text AS reason,
      ${totalStockSql} AS "availableStock",
      TO_CHAR(stock_totals."nearestExpiry", 'YYYY-MM-DD') AS "expiryDate",
      product."imageUrl" AS "imageUrl"
    FROM "Product" product
    LEFT JOIN stock_totals ON stock_totals."productId" = product.id
    WHERE product."isActive" = TRUE
      AND stock_totals."nearestExpiry" < ${date}::date
    ORDER BY
      stock_totals."nearestExpiry" ASC NULLS LAST,
      product."itemName" ASC
    LIMIT 8
  `);

  return {
    outOfStock: Number(counts?.outOfStock ?? 0),
    lowStock: Number(counts?.lowStock ?? 0),
    expiringWithin30Days: Number(counts?.expiringWithin30Days ?? 0),
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      reason: item.reason,
      availableStock: Number(item.availableStock),
      expiryDate: item.expiryDate,
      imageUrl: item.imageUrl,
    })),
  };
}

async function readRecentSales() {
  const sales = await prisma.sale.findMany({
    where: { status: { in: [SaleStatus.PAID, SaleStatus.PENDING] } },
    select: {
      id: true,
      billNo: true,
      soldAt: true,
      customerName: true,
      netTotal: true,
      status: true,
    },
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
    take: 8,
  });
  return sales.map((sale) => ({
    id: sale.id,
    billNo: sale.billNo,
    soldAt: sale.soldAt.toISOString(),
    customerName: sale.customerName,
    netTotal: Number(sale.netTotal),
    status: sale.status === SaleStatus.PAID ? "paid" as const : "pending" as const,
  }));
}

async function readOwnerFinancials(date: string, netSales: number) {
  const report = await readSalesReport({
    view: "daily",
    from: date,
    to: date,
    page: 1,
    pageSize: 1,
  }, true);
  const grossDifference = report.metrics.find((metric) => (
    metric.key === "grossDifference"
  ))?.value ?? null;
  return {
    grossDifference,
    marginPercent: grossDifference !== null && netSales > 0
      ? roundCurrency((grossDifference / netSales) * 100)
      : null,
    ...report.costCoverage,
  };
}

export async function readDashboard(
  canViewProfit: boolean,
  now = new Date(),
): Promise<DashboardResponse> {
  const period = buildDashboardPeriod(now);
  const profile = await readStoreProfile();
  const [today, netPurchases, yesterday, hourly, inventory, recentSales] = await Promise.all([
    readSalesSummary(period.todayStart, period.todayEnd),
    readPurchaseTotal(period.todayStart, period.todayEnd),
    readSalesSummary(period.yesterdayStart, period.yesterdayEnd),
    readHourlyTotals(
      period.todayStart,
      period.todayEnd,
      period.yesterdayStart,
      period.todayStart,
    ),
    readInventorySnapshot(period.date),
    readRecentSales(),
  ]);
  const timeline = buildTimelineHours(profile.openingTime, profile.closingTime);
  const ownerFinancials = canViewProfit
    ? await readOwnerFinancials(period.date, today.netSales)
    : undefined;

  return {
    generatedAt: now.toISOString(),
    date: period.date,
    store: {
      name: profile.storeName,
      openingTime: profile.openingTime,
      closingTime: profile.closingTime,
      isOpen: storeIsOpen(profile.openingTime, profile.closingTime, now),
    },
    today: {
      ...today,
      netPurchases,
      netSalesChangePercent: comparisonPercent(today.netSales, yesterday.netSales),
      averageBillChangePercent: today.averageBill === null || yesterday.averageBill === null
        ? null
        : comparisonPercent(today.averageBill, yesterday.averageBill),
    },
    inventory,
    hourlySales: buildHourlySales(
      timeline,
      hourly.today,
      hourly.yesterday,
      bangkokHour(now),
    ),
    recentSales,
    ...(ownerFinancials ? { ownerFinancials } : {}),
  };
}
