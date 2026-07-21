ALTER TABLE "ProductParentPack"
ADD COLUMN IF NOT EXISTS "sellPriceThb" DECIMAL(14,2);

ALTER TABLE "SaleLine"
ADD COLUMN IF NOT EXISTS "unitPriceThb" DECIMAL(14,2);

DROP INDEX IF EXISTS "ProductParentPack_productId_packUnit_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductParentPack_productId_packUnit_childPackQuantity_key"
ON "ProductParentPack"("productId", "packUnit", "childPackQuantity");

CREATE TABLE IF NOT EXISTS "ProductBarcodeAlias" (
    "barcode" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "parentPackId" TEXT,

    CONSTRAINT "ProductBarcodeAlias_pkey" PRIMARY KEY ("barcode")
);

CREATE INDEX IF NOT EXISTS "ProductBarcodeAlias_productId_idx"
ON "ProductBarcodeAlias"("productId");

CREATE INDEX IF NOT EXISTS "ProductBarcodeAlias_parentPackId_idx"
ON "ProductBarcodeAlias"("parentPackId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ProductBarcodeAlias_productId_fkey'
    ) THEN
        ALTER TABLE "ProductBarcodeAlias"
        ADD CONSTRAINT "ProductBarcodeAlias_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ProductBarcodeAlias_parentPackId_fkey'
    ) THEN
        ALTER TABLE "ProductBarcodeAlias"
        ADD CONSTRAINT "ProductBarcodeAlias_parentPackId_fkey"
        FOREIGN KEY ("parentPackId") REFERENCES "ProductParentPack"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
