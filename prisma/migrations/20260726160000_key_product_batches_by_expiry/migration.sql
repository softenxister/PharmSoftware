DROP INDEX IF EXISTS "ProductBatch_productId_batchNo_key";

CREATE UNIQUE INDEX "ProductBatch_productId_batchNo_expiryDate_key"
ON "ProductBatch"("productId", "batchNo", "expiryDate");
