import { Prisma } from "@server/generated/prisma/client";
import type { SalesProduct, StockProductPage } from "../types";
import type { StockReadQuery } from "./stockReadQuery";
import { prisma } from "../core/prisma";
import { recentSalesWeekRange } from "../sale/weeklySales";
import {
  productGraph,
  productRowToSalesProduct,
  stockBatchIdentityKey,
  type StockProductRow,
} from "./stockProductProjection";
import {
  emptyStockLatestCostsCte,
  firstStockSellPriceSql,
  stockLatestCostsCte,
  stockMarkupPercentSql,
} from "./stockInventorySortSql";
import { latestProductCost } from "@/lib/stockCost";
import {
  readStockInventoryMetadata,
  stockInventorySqlFilters,
  stockTotalsCte,
  totalStockSql,
} from "./stockInventoryMetadata";

export type { StockProductPage } from "../types";

function stockProductWhere(input: StockReadQuery): Prisma.ProductWhereInput {
  if (input.productIds.length > 0) {
    return { isActive: true, id: { in: input.productIds } };
  }
  const and: Prisma.ProductWhereInput[] = [];
  if (input.query) {
    const text = { contains: input.query, mode: "insensitive" as const };
    and.push({
      OR: [
        { itemName: text },
        { brandName: text },
        { barcode: text },
        { externalProductCode: text },
        { manufacturer: { is: { name: text } } },
        { barcodeAliases: { some: { barcode: text } } },
        {
          parentPacks: {
            some: {
              OR: [
                { barcode: text },
                { barcodeAliases: { some: { barcode: text } } },
              ],
            },
          },
        },
      ],
    });
  }
  if (input.filters.categories.length > 0) {
    and.push({ category: { is: { name: { in: input.filters.categories, mode: "insensitive" } } } });
  }
  if (input.filters.legalCategories.length > 0) {
    and.push({ legalCategory: { in: input.filters.legalCategories, mode: "insensitive" } });
  }
  if (input.filters.dosageTypes.length > 0) {
    and.push({ dosageForm: { in: input.filters.dosageTypes, mode: "insensitive" } });
  }
  if (input.filters.manufacturers.length > 0) {
    and.push({ manufacturer: { is: { name: { in: input.filters.manufacturers, mode: "insensitive" } } } });
  }
  if (input.filters.tags.length > 0) {
    and.push({ tagName: { in: input.filters.tags, mode: "insensitive" } });
  }
  return { isActive: true, ...(and.length > 0 ? { AND: and } : {}) };
}

export function requiresAggregateStockRead(input: StockReadQuery): boolean {
  const { filters } = input;
  return input.sort === "weekly"
    || input.sort === "stock"
    || input.sort === "cost"
    || input.sort === "markup"
    || input.sort === "sellPrice"
    || filters.expiryWindows.length > 0
    || filters.stockLevels.length > 0
    || filters.regulatoryForms.length > 0
    || filters.stockRange !== null;
}

async function readRecentSalesWeekRange(): Promise<{ start: Date; end: Date }> {
  const now = new Date();
  const latestPaidSale = await prisma.sale.findFirst({
    where: { status: "PAID", soldAt: { lte: now } },
    orderBy: { soldAt: "desc" },
    select: { soldAt: true },
  });
  return recentSalesWeekRange(latestPaidSale?.soldAt ?? null, now);
}

function filteredStockOrderBy(input: StockReadQuery): Prisma.Sql {
  if (input.sort === "weekly") {
    return Prisma.sql`COALESCE(weekly_sales."weeklySold", 0) DESC, product."itemName" ASC, product.id ASC`;
  }

  const direction = input.sortDirection === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  if (input.sort === "minimum") {
    return Prisma.sql`product."minimumStock" ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "maximum") {
    return Prisma.sql`product."maximumStock" ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "stock") {
    return Prisma.sql`${totalStockSql} ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "cost") {
    return Prisma.sql`COALESCE(latest_costs."latestCost", 0) ${direction}, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "markup") {
    return Prisma.sql`${stockMarkupPercentSql} ${direction} NULLS LAST, product."itemName" ASC, product.id ASC`;
  }
  if (input.sort === "sellPrice") {
    return Prisma.sql`${firstStockSellPriceSql} ${direction}, product."itemName" ASC, product.id ASC`;
  }
  return input.sortDirection === "desc"
    ? Prisma.sql`product."itemName" DESC, product.id DESC`
    : Prisma.sql`product."itemName" ASC, product.id ASC`;
}

async function readFilteredStockProductIds(
  input: StockReadQuery,
): Promise<{ ids: string[]; total: number; weeklySoldByProductId: ReadonlyMap<string, number> }> {
  const where = stockInventorySqlFilters(input);

  const orderBy = filteredStockOrderBy(input);
  const offset = (input.page - 1) * input.pageSize;
  const weekRange = input.sort === "weekly" ? await readRecentSalesWeekRange() : null;
  const weeklySalesCte = weekRange
    ? Prisma.sql`
      weekly_sales AS (
        SELECT
          line."productId",
          SUM(line.quantity * line."packMultiplier")::double precision AS "weeklySold"
        FROM "SaleLine" line
        INNER JOIN "Sale" sale ON sale.id = line."saleId"
        WHERE sale.status = 'PAID'
          AND sale."soldAt" >= ${weekRange.start}
          AND sale."soldAt" <= ${weekRange.end}
        GROUP BY line."productId"
      )
    `
    : Prisma.sql`weekly_sales AS (
      SELECT NULL::text AS "productId", NULL::double precision AS "weeklySold"
      WHERE FALSE
    )`;
  const weeklySoldSelect = input.sort === "weekly"
    ? Prisma.sql`COALESCE(weekly_sales."weeklySold", 0)`
    : Prisma.sql`product."weeklySold"`;
  const latestCostsCte = input.sort === "cost" || input.sort === "markup"
    ? stockLatestCostsCte
    : emptyStockLatestCostsCte;
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    total: number;
    weeklySold: number;
  }>>(Prisma.sql`
    WITH ${stockTotalsCte}, ${weeklySalesCte}, ${latestCostsCte}
    SELECT product.id, COUNT(*) OVER()::integer AS total
      , ${weeklySoldSelect}::double precision AS "weeklySold"
    FROM "Product" product
    LEFT JOIN "Category" category ON category.id = product."categoryId"
    INNER JOIN "Manufacturer" manufacturer ON manufacturer.id = product."manufacturerId"
    LEFT JOIN stock_totals ON stock_totals."productId" = product.id
    LEFT JOIN weekly_sales ON weekly_sales."productId" = product.id
    LEFT JOIN latest_costs ON latest_costs."productId" = product.id
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY ${orderBy}
    LIMIT ${input.pageSize}
    OFFSET ${offset}
  `);
  return {
    ids: rows.map((row) => row.id),
    total: Number(rows[0]?.total ?? 0),
    weeklySoldByProductId: input.sort === "weekly"
      ? new Map(rows.map((row) => [row.id, Number(row.weeklySold)]))
      : new Map(),
  };
}

async function readBatchCosts(productIds: string[]): Promise<ReadonlyMap<string, number>> {
  if (productIds.length === 0) return new Map();
  const purchaseLines = await prisma.$queryRaw<Array<{
    productId: string;
    batchNo: string | null;
    expiryDate: string;
    cost: unknown;
  }>>(Prisma.sql`
    SELECT DISTINCT ON (line."productId", line."batchNo", line."expiryDate")
      line."productId",
      line."batchNo",
      line."expiryDate",
      line."cost" / NULLIF(line."unitMultiplier", 0) AS "cost"
    FROM "PurchaseLine" line
    INNER JOIN "PurchaseBill" bill ON bill."id" = line."purchaseBillId"
    WHERE line."productId" IN (${Prisma.join(productIds)})
      AND bill.status = 'RECEIVED'
      AND line."cost" > 0
      AND line."unitMultiplier" > 0
    ORDER BY line."productId", line."batchNo", line."expiryDate", bill."purchasedAt" DESC, bill."createdAt" DESC
  `);
  const batchCosts = new Map<string, number>();
  for (const line of purchaseLines) {
    batchCosts.set(
      stockBatchIdentityKey(line.productId, line.batchNo, line.expiryDate),
      Number(line.cost),
    );
  }
  return batchCosts;
}

async function readLatestProductCosts(productIds: string[]): Promise<ReadonlyMap<string, number>> {
  if (productIds.length === 0) return new Map();
  const [purchaseCosts, products] = await Promise.all([
    prisma.$queryRaw<Array<{
      productId: string;
      costThb: unknown;
      unitMultiplier: unknown;
    }>>(Prisma.sql`
      SELECT DISTINCT ON (line."productId")
        line."productId",
        line."cost" AS "costThb",
        line."unitMultiplier"
      FROM "PurchaseLine" line
      INNER JOIN "PurchaseBill" bill ON bill."id" = line."purchaseBillId"
      WHERE line."productId" IN (${Prisma.join(productIds)})
        AND bill.status = 'RECEIVED'
        AND line."cost" > 0
        AND line."unitMultiplier" > 0
      ORDER BY
        line."productId",
        bill."purchasedAt" DESC,
        bill."createdAt" DESC,
        line.id DESC
    `),
    prisma.$queryRaw<Array<{ id: string; migrationCostThb: unknown }>>(Prisma.sql`
      SELECT id, "migrationCostThb"
      FROM "Product"
      WHERE id IN (${Prisma.join(productIds)})
    `),
  ]);
  const latestPurchaseCostByProductId = new Map<string, {
    costThb: number;
    unitMultiplier: number;
  }>();
  for (const row of purchaseCosts) {
    latestPurchaseCostByProductId.set(row.productId, {
      costThb: Number(row.costThb),
      unitMultiplier: Number(row.unitMultiplier),
    });
  }
  const latestCosts = new Map<string, number>();
  for (const product of products) {
    const latestCost = latestProductCost(
      latestPurchaseCostByProductId.get(product.id),
      product.migrationCostThb === null ? null : Number(product.migrationCostThb),
    );
    if (latestCost !== undefined) latestCosts.set(product.id, latestCost);
  }
  return latestCosts;
}

async function readWeeklySoldQuantities(productIds: string[]): Promise<ReadonlyMap<string, number>> {
  if (productIds.length === 0) return new Map();
  const weekRange = await readRecentSalesWeekRange();
  const rows = await prisma.$queryRaw<Array<{ productId: string; weeklySold: number }>>(Prisma.sql`
    SELECT
      line."productId",
      SUM(line.quantity * line."packMultiplier")::double precision AS "weeklySold"
    FROM "SaleLine" line
    INNER JOIN "Sale" sale ON sale.id = line."saleId"
    WHERE line."productId" IN (${Prisma.join(productIds)})
      AND sale.status = 'PAID'
      AND sale."soldAt" >= ${weekRange.start}
      AND sale."soldAt" <= ${weekRange.end}
    GROUP BY line."productId"
  `);
  return new Map(rows.map((row) => [row.productId, Number(row.weeklySold)]));
}

type StockProductMetrics = {
  batchCosts: ReadonlyMap<string, number>;
  latestCosts: ReadonlyMap<string, number>;
  weeklySoldByProductId: ReadonlyMap<string, number>;
  missingWeeklySoldByProductId: ReadonlyMap<string, number>;
};

async function readStockProductMetrics(
  productIds: string[],
  weeklySoldByProductId: ReadonlyMap<string, number> = new Map(),
): Promise<StockProductMetrics> {
  const missingWeeklySoldProductIds = productIds.filter((id) => !weeklySoldByProductId.has(id));
  const [batchCosts, latestCosts, missingWeeklySoldByProductId] = await Promise.all([
    readBatchCosts(productIds),
    readLatestProductCosts(productIds),
    readWeeklySoldQuantities(missingWeeklySoldProductIds),
  ]);
  return {
    batchCosts,
    latestCosts,
    weeklySoldByProductId,
    missingWeeklySoldByProductId,
  };
}

function projectSalesProducts(
  products: StockProductRow[],
  metrics: StockProductMetrics,
): SalesProduct[] {
  return products.map((product) => productRowToSalesProduct(
    product,
    metrics.batchCosts,
    metrics.weeklySoldByProductId.get(product.id)
      ?? metrics.missingWeeklySoldByProductId.get(product.id)
      ?? 0,
    metrics.latestCosts.get(product.id),
  ));
}

async function rowsToSalesProducts(
  products: StockProductRow[],
  weeklySoldByProductId: ReadonlyMap<string, number> = new Map(),
): Promise<SalesProduct[]> {
  const metrics = await readStockProductMetrics(
    products.map((product) => product.id),
    weeklySoldByProductId,
  );
  return projectSalesProducts(products, metrics);
}

export async function readStockProduct(productId: string): Promise<SalesProduct | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    include: productGraph,
  });
  if (!product) return null;
  return (await rowsToSalesProducts([product]))[0] ?? null;
}

export async function readStockProducts(input: StockReadQuery): Promise<StockProductPage> {
  if (input.productIds.length === 0 && requiresAggregateStockRead(input)) {
    const [filtered, metadata] = await Promise.all([
      readFilteredStockProductIds(input),
      input.includeInventoryMetadata ? readStockInventoryMetadata(input) : Promise.resolve(null),
    ]);
    const total = metadata?.total ?? filtered.total;
    if (filtered.ids.length === 0) {
      return {
        products: [],
        page: input.page,
        pageSize: input.pageSize,
        total,
        hasMore: false,
        ...(metadata ? { inventory: metadata.inventory } : {}),
      };
    }
    const [rows, metrics] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: filtered.ids } },
        include: productGraph,
      }),
      readStockProductMetrics(filtered.ids, filtered.weeklySoldByProductId),
    ]);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const orderedRows = filtered.ids
      .map((id) => rowById.get(id))
      .filter((row): row is StockProductRow => Boolean(row));
    return {
      products: projectSalesProducts(orderedRows, metrics),
      page: input.page,
      pageSize: input.pageSize,
      total,
      hasMore: input.page * input.pageSize < total,
      ...(metadata ? { inventory: metadata.inventory } : {}),
    };
  }

  const where = stockProductWhere(input);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = input.sort === "weekly"
    ? [{ weeklySold: "desc" }, { itemName: "asc" }, { id: "asc" }]
    : input.sort === "minimum"
      ? [{ minimumStock: input.sortDirection }, { itemName: "asc" }, { id: "asc" }]
      : input.sort === "maximum"
        ? [{ maximumStock: input.sortDirection }, { itemName: "asc" }, { id: "asc" }]
        : [{ itemName: input.sortDirection }, { id: input.sortDirection }];
  const [fallbackTotal, productIdRows, metadata] = await Promise.all([
    input.includeInventoryMetadata ? Promise.resolve(null) : prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: { id: true },
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    input.includeInventoryMetadata ? readStockInventoryMetadata(input) : Promise.resolve(null),
  ]);
  const total = metadata?.total ?? fallbackTotal ?? 0;
  const productIds = productIdRows.map((product) => product.id);
  if (productIds.length === 0) {
    return {
      products: [],
      page: input.page,
      pageSize: input.pageSize,
      total,
      hasMore: false,
      ...(metadata ? { inventory: metadata.inventory } : {}),
    };
  }
  const [rows, metrics] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: productGraph,
    }),
    readStockProductMetrics(productIds),
  ]);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = productIds
    .map((id) => rowById.get(id))
    .filter((row): row is StockProductRow => Boolean(row));

  return {
    products: projectSalesProducts(orderedRows, metrics),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
    ...(metadata ? { inventory: metadata.inventory } : {}),
  };
}
