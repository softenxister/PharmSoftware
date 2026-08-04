-- Existing purchase records are dummy setup data and must not affect average cost.
-- PurchaseLine and PurchaseCorrectionRequest rows are removed by cascade; linked
-- stock adjustments remain as inventory audit records with a null purchaseBillId.
DELETE FROM "PurchaseBill";

ALTER TABLE "Product"
ADD COLUMN "migrationCostThb" DECIMAL(14,2);

ALTER TABLE "Product"
ADD CONSTRAINT "Product_migrationCostThb_positive_check"
CHECK ("migrationCostThb" IS NULL OR "migrationCostThb" > 0);
