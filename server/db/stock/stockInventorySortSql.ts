import { Prisma } from "@server/generated/prisma/client";

export const firstStockSellPriceSql = Prisma.sql`
  COALESCE(
    (
      SELECT price_batch."sellPriceThb"
      FROM "ProductBatch" price_batch
      WHERE price_batch."productId" = product.id
      ORDER BY price_batch."expiryDate" ASC, price_batch."batchNo" ASC
      LIMIT 1
    ),
    0
  )
`;

export const stockMarkupPercentSql = Prisma.sql`
  CASE
    WHEN ${firstStockSellPriceSql} > 0 AND average_costs."averageCost" > 0
      THEN ROUND(
        (
          (${firstStockSellPriceSql} - average_costs."averageCost")
          / average_costs."averageCost"
        ) * 100,
        2
      )
    ELSE NULL
  END
`;

export const stockAverageCostsCte = Prisma.sql`
  latest_distributor_costs AS (
    SELECT DISTINCT ON (
      line."productId",
      COALESCE(bill."distributorId", LOWER(BTRIM(bill."distributorName")))
    )
      line."productId",
      line."cost" / NULLIF(line."unitMultiplier", 0) AS "normalizedCost"
    FROM "PurchaseLine" line
    INNER JOIN "PurchaseBill" bill ON bill.id = line."purchaseBillId"
    WHERE bill.status = 'RECEIVED'
      AND line."cost" > 0
      AND line."unitMultiplier" > 0
    ORDER BY
      line."productId",
      COALESCE(bill."distributorId", LOWER(BTRIM(bill."distributorName"))),
      bill."purchasedAt" DESC,
      bill."createdAt" DESC,
      line.id DESC
  ),
  average_costs AS (
    SELECT
      observation."productId",
      ROUND(AVG(observation."normalizedCost"), 2) AS "averageCost"
    FROM (
      SELECT "productId", "normalizedCost" FROM latest_distributor_costs
      UNION ALL
      SELECT id AS "productId", "migrationCostThb" AS "normalizedCost"
      FROM "Product"
      WHERE "migrationCostThb" > 0
    ) observation
    GROUP BY observation."productId"
  )
`;

export const emptyStockAverageCostsCte = Prisma.sql`
  average_costs AS (
    SELECT NULL::text AS "productId", NULL::numeric AS "averageCost"
    WHERE FALSE
  )
`;
