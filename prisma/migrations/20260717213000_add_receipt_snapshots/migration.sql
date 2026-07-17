-- Add Store Profile operating hours used by receipts.
ALTER TABLE "StoreProfile"
ADD COLUMN "openingTime" TEXT NOT NULL DEFAULT '',
ADD COLUMN "closingTime" TEXT NOT NULL DEFAULT '';

-- Preserve immutable receipt data for every newly paid sale.
ALTER TABLE "Sale"
ADD COLUMN "receiptSnapshot" JSONB;

-- Preserve the original checkout order for legacy receipt reconstruction.
ALTER TABLE "SaleLine"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
