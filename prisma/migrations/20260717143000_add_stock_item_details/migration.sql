ALTER TABLE "Product"
ADD COLUMN "minimumStock" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "maximumStock" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isDiscountLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isReturnable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "defaultDoseMorning" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defaultDoseNoon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defaultDoseEvening" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defaultDoseNight" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tagName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Product"
ADD CONSTRAINT "Product_stock_detail_values_check" CHECK (
  "minimumStock" >= 0
  AND "maximumStock" >= "minimumStock"
  AND "discountPercent" BETWEEN 0 AND 100
  AND "defaultDoseMorning" BETWEEN 0 AND 99
  AND "defaultDoseNoon" BETWEEN 0 AND 99
  AND "defaultDoseEvening" BETWEEN 0 AND 99
  AND "defaultDoseNight" BETWEEN 0 AND 99
);
