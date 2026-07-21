ALTER TABLE "Product"
ADD COLUMN "externalProductCode" TEXT;

CREATE UNIQUE INDEX "Product_externalProductCode_key"
ON "Product"("externalProductCode");
