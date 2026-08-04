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
        COALESCE(ppt."totalPurchase", 0) + COALESCE(ipt."totalPurchase", 0),
        0
      ) / 10
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
    WHEN ll.points <= 100 THEN 'Bronze'
    WHEN ll.points <= 500 THEN 'Silver'
    WHEN ll.points <= 2000 THEN 'Gold'
    WHEN ll.points <= 10000 THEN 'Platinum'
    ELSE 'Diamond'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM lifetime_loyalty ll
WHERE c.id = ll.id;
