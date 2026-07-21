CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_isActive_itemName_id_idx"
ON "Product"("isActive", "itemName", "id");

CREATE INDEX IF NOT EXISTS "Product_isActive_weeklySold_itemName_id_idx"
ON "Product"("isActive", "weeklySold", "itemName", "id");

CREATE INDEX IF NOT EXISTS "ProductBatch_productId_expiryDate_idx"
ON "ProductBatch"("productId", "expiryDate");

CREATE INDEX IF NOT EXISTS "PurchaseBill_purchasedAt_createdAt_idx"
ON "PurchaseBill"("purchasedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "PurchaseLine_productId_batchNo_idx"
ON "PurchaseLine"("productId", "batchNo");

CREATE INDEX IF NOT EXISTS "Product_itemName_trgm_idx"
ON "Product" USING GIN ("itemName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_brandName_trgm_idx"
ON "Product" USING GIN ("brandName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Manufacturer_name_trgm_idx"
ON "Manufacturer" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_barcode_trgm_idx"
ON "Product" USING GIN ("barcode" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductBarcodeAlias_barcode_trgm_idx"
ON "ProductBarcodeAlias" USING GIN ("barcode" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductParentPack_barcode_trgm_idx"
ON "ProductParentPack" USING GIN ("barcode" gin_trgm_ops)
WHERE "barcode" IS NOT NULL;
