DROP INDEX IF EXISTS "ProductBatch_productId_batchNo_expiryDate_key";

ALTER TABLE "ProductBatch" ALTER COLUMN "batchNo" DROP NOT NULL;
ALTER TABLE "PurchaseLine" ALTER COLUMN "batchNo" DROP NOT NULL;
ALTER TABLE "StockAdjustmentLine" ALTER COLUMN "batchNo" DROP NOT NULL;

WITH normalized_batches AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "productId", "expiryDate"
      ORDER BY "createdAt", "id"
    ) AS batch_rank,
    SUM("availableStock") OVER (
      PARTITION BY "productId", "expiryDate"
    ) AS total_stock
  FROM "ProductBatch"
  WHERE
    BTRIM("batchNo") = ''
    OR "batchNo" ~ '^PUR-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
)
UPDATE "ProductBatch" AS batch
SET
  "batchNo" = NULL,
  "availableStock" = normalized.total_stock,
  "updatedAt" = CURRENT_TIMESTAMP
FROM normalized_batches AS normalized
WHERE batch."id" = normalized."id"
  AND normalized.batch_rank = 1;

DELETE FROM "ProductBatch" AS duplicate
USING "ProductBatch" AS canonical
WHERE canonical."batchNo" IS NULL
  AND duplicate."productId" = canonical."productId"
  AND duplicate."expiryDate" = canonical."expiryDate"
  AND duplicate."id" <> canonical."id"
  AND (
    BTRIM(duplicate."batchNo") = ''
    OR duplicate."batchNo" ~ '^PUR-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  );

UPDATE "PurchaseLine"
SET "batchNo" = NULL
WHERE
  BTRIM("batchNo") = ''
  OR "batchNo" ~ '^PUR-[0-9]{4}-[0-9]{2}-[0-9]{2}$';

UPDATE "StockAdjustmentLine"
SET "batchNo" = NULL
WHERE
  BTRIM("batchNo") = ''
  OR "batchNo" ~ '^PUR-[0-9]{4}-[0-9]{2}-[0-9]{2}$';

CREATE UNIQUE INDEX "ProductBatch_productId_batchNo_expiryDate_key"
ON "ProductBatch"("productId", "batchNo", "expiryDate")
NULLS NOT DISTINCT;
