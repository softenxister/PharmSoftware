DROP INDEX IF EXISTS "ProductBatch_productId_batchNo_expiryDate_key";

UPDATE "ProductBatch"
SET "expiryDate" = TO_CHAR(TO_DATE("expiryDate", 'DD/MM/YYYY'), 'YYYY-MM-DD')
WHERE "expiryDate" ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$';

UPDATE "PurchaseLine"
SET "expiryDate" = TO_CHAR(TO_DATE("expiryDate", 'DD/MM/YYYY'), 'YYYY-MM-DD')
WHERE "expiryDate" ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$';

UPDATE "SaleLine"
SET "expiryDate" = TO_CHAR(TO_DATE("expiryDate", 'DD/MM/YYYY'), 'YYYY-MM-DD')
WHERE "expiryDate" ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$';

WITH ranked_batches AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "productId", "batchNo", "expiryDate"
      ORDER BY "createdAt", "id"
    ) AS batch_rank,
    SUM("availableStock") OVER (
      PARTITION BY "productId", "batchNo", "expiryDate"
    ) AS total_stock
  FROM "ProductBatch"
),
canonical_batches AS (
  UPDATE "ProductBatch" AS batch
  SET
    "availableStock" = ranked.total_stock,
    "updatedAt" = CURRENT_TIMESTAMP
  FROM ranked_batches AS ranked
  WHERE batch."id" = ranked."id"
    AND ranked.batch_rank = 1
  RETURNING batch."id"
)
DELETE FROM "ProductBatch" AS duplicate
USING ranked_batches AS ranked
WHERE duplicate."id" = ranked."id"
  AND ranked.batch_rank > 1;

CREATE UNIQUE INDEX "ProductBatch_productId_batchNo_expiryDate_key"
ON "ProductBatch"("productId", "batchNo", "expiryDate")
NULLS NOT DISTINCT;

ALTER TABLE "ProductBatch"
ADD CONSTRAINT "ProductBatch_expiryDate_iso_check"
CHECK (
  "expiryDate" = ''
  OR (
    "expiryDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND TO_CHAR(TO_DATE("expiryDate", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "expiryDate"
  )
);

ALTER TABLE "PurchaseLine"
ADD CONSTRAINT "PurchaseLine_expiryDate_iso_check"
CHECK (
  "expiryDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND TO_CHAR(TO_DATE("expiryDate", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "expiryDate"
);

ALTER TABLE "SaleLine"
ADD CONSTRAINT "SaleLine_expiryDate_iso_check"
CHECK (
  "expiryDate" = ''
  OR (
    "expiryDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND TO_CHAR(TO_DATE("expiryDate", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "expiryDate"
  )
);
