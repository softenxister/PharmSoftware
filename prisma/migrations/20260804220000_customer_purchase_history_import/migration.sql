CREATE TABLE "CustomerPurchaseHistoryImport" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "externalProductCode" TEXT NOT NULL,
    "sourceItemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "reportStartedAt" TIMESTAMP(3),
    "reportEndedAt" TIMESTAMP(3),
    "sourceFileName" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "customerRow" INTEGER NOT NULL,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPurchaseHistoryImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPurchaseHistoryImport_sourceFileHash_sourceRow_key"
ON "CustomerPurchaseHistoryImport"("sourceFileHash", "sourceRow");

CREATE INDEX "CustomerPurchaseHistoryImport_customerId_reportEndedAt_idx"
ON "CustomerPurchaseHistoryImport"("customerId", "reportEndedAt");

CREATE INDEX "CustomerPurchaseHistoryImport_productId_idx"
ON "CustomerPurchaseHistoryImport"("productId");

ALTER TABLE "CustomerPurchaseHistoryImport"
ADD CONSTRAINT "CustomerPurchaseHistoryImport_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerPurchaseHistoryImport"
ADD CONSTRAINT "CustomerPurchaseHistoryImport_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
