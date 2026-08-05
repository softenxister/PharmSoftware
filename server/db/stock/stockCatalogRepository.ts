import { Prisma } from "@server/generated/prisma/client";
import type { SalesProduct } from "../types";
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
  emptyStockAverageCostsCte,
  firstStockSellPriceSql,
  stockAverageCostsCte,
  stockMarkupPercentSql,
} from "./stockInventorySortSql";
import { averageProductCost } from "@/lib/stockCost";

export type StockProductPage = {
  products: SalesProduct[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

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
  if (input.filters.dosageTypes.length > 0) {
    and.push({ childUnit: { in: input.filters.dosageTypes, mode: "insensitive" } });
  }
  if (input.filters.manufacturers.length > 0) {
    and.push({ manufacturer: { is: { name: { in: input.filters.manufacturers, mode: "insensitive" } } } });
  }
  if (input.filters.tags.length > 0) {
    and.push({ tagName: { in: input.filters.tags, mode: "insensitive" } });
  }
  return { isActive: true, ...(and.length > 0 ? { AND: and } : {}) };
}

function requiresAggregateStockRead(input: StockReadQuery): boolean {
  const { filters } = input;
  return input.sort === "weekly"
    || input.sort === "stock"
    || input.sort === "cost"
    || input.sort === "markup"
    || input.sort === "sellPrice"
    || filters.expiryWindows.length > 0
    || filters.stockLevels.length > 0
    || filters.stockRange !== null;
}

function lowerValues(values: string[]): string[] {
  return values.map((value) => value.toLocaleLowerCase("en-US"));
}

const totalStockSql = Prisma.sql`COALESCE(SUM(batch."availableStock"), 0)`;
async function readRecentSalesWeekRange(): Promise<{ start: Date; end: Date }> {
  const now = new Date();
  const latestPaidSale = await prisma.sale.findFirst({
    where: { status: "PAID", soldAt: { lte: now } },
    orderBy: { soldAt: "desc" },
    select: { soldAt: true },
  });
  return recentSalesWeekRange(latestPaidSale?.soldAt ?? null, now);
}

const nearestExpirySql = Prisma.sql`
  MIN(
    CASE
      WHEN batch."expiryDate" ~ '^\\d{4}-\\d{2}-\\d{2}$'
        THEN TO_DATE(batch."expiryDate", 'YYYY-MM-DD')
      WHEN batch."expiryDate" ~ '^\\d{2}/\\d{2}/\\d{4}$'
        THEN TO_DATE(batch."expiryDate", 'DD/MM/YYYY')
      ELSE NULL
    END
  )
`;

function stockLevelCondition(level: string): Prisma.Sql {
  if (level === "Out of Stock") return Prisma.sql`${totalStockSql} <= 0`;
  if (level === "Low Stock") {
    return Prisma.sql`(${totalStockSql} > 0 AND ${totalStockSql} < product."minimumStock")`;
  }
  if (level === "Overstock") return Prisma.sql`${totalStockSql} > product."maximumStock"`;
  return Prisma.sql`(${totalStockSql} >= product."minimumStock" AND ${totalStockSql} <= product."maximumStock")`;
}

function expiryWindowCondition(window: string): Prisma.Sql {
  if (window === "No expiry date") return Prisma.sql`${nearestExpirySql} IS NULL`;
  if (window === "Expired") return Prisma.sql`${nearestExpirySql} < CURRENT_DATE`;
  if (window === "Within 30 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`;
  }
  if (window === "31–90 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 90`;
  }
  if (window === "91–180 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 91 AND CURRENT_DATE + 180`;
  }
  if (window === "181–365 days") {
    return Prisma.sql`${nearestExpirySql} BETWEEN CURRENT_DATE + 181 AND CURRENT_DATE + 365`;
  }
  return Prisma.sql`${nearestExpirySql} > CURRENT_DATE + 365`;
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
    return Prisma.sql`COALESCE(average_costs."averageCost", 0) ${direction}, product."itemName" ASC, product.id ASC`;
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
  const where: Prisma.Sql[] = [Prisma.sql`product."isActive" = TRUE`];
  const having: Prisma.Sql[] = [];
  const { filters } = input;

  if (input.query) {
    const pattern = `%${input.query}%`;
    where.push(Prisma.sql`(
      product."itemName" ILIKE ${pattern}
      OR product."brandName" ILIKE ${pattern}
      OR product."barcode" ILIKE ${pattern}
      OR product."externalProductCode" ILIKE ${pattern}
      OR manufacturer.name ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM "ProductBarcodeAlias" alias
        WHERE alias."productId" = product.id AND alias.barcode ILIKE ${pattern}
      )
      OR EXISTS (
        SELECT 1
        FROM "ProductParentPack" parent_pack
        LEFT JOIN "ProductBarcodeAlias" parent_alias ON parent_alias."parentPackId" = parent_pack.id
        WHERE parent_pack."productId" = product.id
          AND (parent_pack.barcode ILIKE ${pattern} OR parent_alias.barcode ILIKE ${pattern})
      )
    )`);
  }
  if (filters.categories.length > 0) {
    where.push(Prisma.sql`LOWER(category.name) IN (${Prisma.join(lowerValues(filters.categories))})`);
  }
  if (filters.dosageTypes.length > 0) {
    where.push(Prisma.sql`LOWER(product."childUnit") IN (${Prisma.join(lowerValues(filters.dosageTypes))})`);
  }
  if (filters.manufacturers.length > 0) {
    where.push(Prisma.sql`LOWER(manufacturer.name) IN (${Prisma.join(lowerValues(filters.manufacturers))})`);
  }
  if (filters.tags.length > 0) {
    where.push(Prisma.sql`LOWER(product."tagName") IN (${Prisma.join(lowerValues(filters.tags))})`);
  }
  if (filters.stockLevels.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.stockLevels.map(stockLevelCondition), " OR ")})`);
  }
  if (filters.expiryWindows.length > 0) {
    having.push(Prisma.sql`(${Prisma.join(filters.expiryWindows.map(expiryWindowCondition), " OR ")})`);
  }
  if (filters.stockRange?.min !== null && filters.stockRange?.min !== undefined) {
    having.push(Prisma.sql`${totalStockSql} >= ${filters.stockRange.min}`);
  }
  if (filters.stockRange?.max !== null && filters.stockRange?.max !== undefined) {
    having.push(Prisma.sql`${totalStockSql} <= ${filters.stockRange.max}`);
  }

  const orderBy = filteredStockOrderBy(input);
  const offset = (input.page - 1) * input.pageSize;
  const weekRange = await readRecentSalesWeekRange();
  const weeklySalesCte = input.sort === "weekly"
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
  const averageCostsCte = input.sort === "cost" || input.sort === "markup"
    ? stockAverageCostsCte
    : emptyStockAverageCostsCte;
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    total: number;
    weeklySold: number;
  }>>(Prisma.sql`
    WITH ${weeklySalesCte}, ${averageCostsCte}
    SELECT product.id, COUNT(*) OVER()::integer AS total
      , ${weeklySoldSelect}::double precision AS "weeklySold"
    FROM "Product" product
    INNER JOIN "Category" category ON category.id = product."categoryId"
    INNER JOIN "Manufacturer" manufacturer ON manufacturer.id = product."manufacturerId"
    LEFT JOIN "ProductBatch" batch ON batch."productId" = product.id
    LEFT JOIN weekly_sales ON weekly_sales."productId" = product.id
    LEFT JOIN average_costs ON average_costs."productId" = product.id
    WHERE ${Prisma.join(where, " AND ")}
    GROUP BY product.id, weekly_sales."weeklySold", average_costs."averageCost"
    ${having.length > 0 ? Prisma.sql`HAVING ${Prisma.join(having, " AND ")}` : Prisma.empty}
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

async function readAverageProductCosts(productIds: string[]): Promise<ReadonlyMap<string, number>> {
  if (productIds.length === 0) return new Map();
  const [purchaseCosts, products] = await Promise.all([
    prisma.$queryRaw<Array<{
      productId: string;
      costThb: unknown;
      unitMultiplier: unknown;
    }>>(Prisma.sql`
      SELECT DISTINCT ON (
        line."productId",
        COALESCE(bill."distributorId", LOWER(BTRIM(bill."distributorName")))
      )
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
        COALESCE(bill."distributorId", LOWER(BTRIM(bill."distributorName"))),
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
  const distributorCostsByProductId = new Map<string, Array<{
    costThb: number;
    unitMultiplier: number;
  }>>();
  for (const row of purchaseCosts) {
    const costs = distributorCostsByProductId.get(row.productId) ?? [];
    costs.push({ costThb: Number(row.costThb), unitMultiplier: Number(row.unitMultiplier) });
    distributorCostsByProductId.set(row.productId, costs);
  }
  const averageCosts = new Map<string, number>();
  for (const product of products) {
    const average = averageProductCost(
      distributorCostsByProductId.get(product.id) ?? [],
      product.migrationCostThb === null ? null : Number(product.migrationCostThb),
    );
    if (average !== undefined) averageCosts.set(product.id, average);
  }
  return averageCosts;
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

async function rowsToSalesProducts(
  products: StockProductRow[],
  weeklySoldByProductId: ReadonlyMap<string, number> = new Map(),
): Promise<SalesProduct[]> {
  const productIds = products.map((product) => product.id);
  const missingWeeklySoldProductIds = productIds.filter((id) => !weeklySoldByProductId.has(id));
  const [batchCosts, averageCosts, missingWeeklySoldByProductId] = await Promise.all([
    readBatchCosts(productIds),
    readAverageProductCosts(productIds),
    readWeeklySoldQuantities(missingWeeklySoldProductIds),
  ]);
  return products.map((product) => productRowToSalesProduct(
    product,
    batchCosts,
    weeklySoldByProductId.get(product.id) ?? missingWeeklySoldByProductId.get(product.id) ?? 0,
    averageCosts.get(product.id),
  ));
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
    const filtered = await readFilteredStockProductIds(input);
    if (filtered.ids.length === 0) {
      return {
        products: [],
        page: input.page,
        pageSize: input.pageSize,
        total: filtered.total,
        hasMore: false,
      };
    }
    const rows = await prisma.product.findMany({
      where: { id: { in: filtered.ids } },
      include: productGraph,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const orderedRows = filtered.ids
      .map((id) => rowById.get(id))
      .filter((row): row is StockProductRow => Boolean(row));
    return {
      products: await rowsToSalesProducts(orderedRows, filtered.weeklySoldByProductId),
      page: input.page,
      pageSize: input.pageSize,
      total: filtered.total,
      hasMore: input.page * input.pageSize < filtered.total,
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
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productGraph,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);

  return {
    products: await rowsToSalesProducts(products),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
  };
}
