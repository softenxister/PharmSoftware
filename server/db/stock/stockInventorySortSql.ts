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
    WHEN ${firstStockSellPriceSql} > 0 AND latest_costs."latestCost" > 0
      THEN ROUND(
        (
          (${firstStockSellPriceSql} - latest_costs."latestCost")
          / latest_costs."latestCost"
        ) * 100,
        2
      )
    ELSE NULL
  END
`;

export const stockLatestCostsCte = Prisma.sql`
  latest_purchase_costs AS (
    SELECT DISTINCT ON (line."productId")
      line."productId",
      line."cost" / NULLIF(line."unitMultiplier", 0) AS "normalizedCost"
    FROM "PurchaseLine" line
    INNER JOIN "PurchaseBill" bill ON bill.id = line."purchaseBillId"
    WHERE bill.status = 'RECEIVED'
      AND line."cost" > 0
      AND line."unitMultiplier" > 0
    ORDER BY
      line."productId",
      bill."purchasedAt" DESC,
      bill."createdAt" DESC,
      line.id DESC
  ),
  latest_costs AS (
    SELECT
      product.id AS "productId",
      ROUND(
        COALESCE(latest_purchase_costs."normalizedCost", product."migrationCostThb"),
        2
      ) AS "latestCost"
    FROM "Product" product
    LEFT JOIN latest_purchase_costs ON latest_purchase_costs."productId" = product.id
    WHERE latest_purchase_costs."normalizedCost" > 0 OR product."migrationCostThb" > 0
  )
`;

export const emptyStockLatestCostsCte = Prisma.sql`
  latest_costs AS (
    SELECT NULL::text AS "productId", NULL::numeric AS "latestCost"
    WHERE FALSE
  )
`;
