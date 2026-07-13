-- CreateEnum
CREATE TYPE "PurchaseCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PurchaseCorrectionRequest" (
    "id" TEXT NOT NULL,
    "purchaseBillId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PurchaseCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    CONSTRAINT "PurchaseCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "purchaseBillId" TEXT,
    "correctionRequestId" TEXT,
    "reason" TEXT NOT NULL,
    "adjustedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustmentLine" (
    "id" TEXT NOT NULL,
    "stockAdjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "previousQuantity" DECIMAL(14,3) NOT NULL,
    "newQuantity" DECIMAL(14,3) NOT NULL,
    "delta" DECIMAL(14,3) NOT NULL,
    CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseCorrectionRequest_purchaseBillId_idx" ON "PurchaseCorrectionRequest"("purchaseBillId");
CREATE INDEX "PurchaseCorrectionRequest_status_requestedAt_idx" ON "PurchaseCorrectionRequest"("status", "requestedAt");
CREATE UNIQUE INDEX "PurchaseCorrectionRequest_one_pending_per_bill" ON "PurchaseCorrectionRequest"("purchaseBillId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "StockAdjustment_correctionRequestId_key" ON "StockAdjustment"("correctionRequestId");
CREATE INDEX "StockAdjustment_purchaseBillId_idx" ON "StockAdjustment"("purchaseBillId");
CREATE INDEX "StockAdjustment_createdAt_idx" ON "StockAdjustment"("createdAt");
CREATE INDEX "StockAdjustmentLine_stockAdjustmentId_idx" ON "StockAdjustmentLine"("stockAdjustmentId");
CREATE INDEX "StockAdjustmentLine_productId_batchNo_idx" ON "StockAdjustmentLine"("productId", "batchNo");

-- AddForeignKey
ALTER TABLE "PurchaseCorrectionRequest" ADD CONSTRAINT "PurchaseCorrectionRequest_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_correctionRequestId_fkey" FOREIGN KEY ("correctionRequestId") REFERENCES "PurchaseCorrectionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
