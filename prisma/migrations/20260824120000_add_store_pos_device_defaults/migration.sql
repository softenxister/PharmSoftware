-- Add shared receipt and cash-drawer defaults while preserving existing store settings.
ALTER TABLE "StorePosSettings"
    ADD COLUMN "billingDevice" TEXT NOT NULL DEFAULT 'Front Counter Thermal Printer',
    ADD COLUMN "paperSize" TEXT NOT NULL DEFAULT '80',
    ADD COLUMN "cashDrawerDevice" TEXT NOT NULL DEFAULT 'Front Counter Cash Drawer',
    ADD COLUMN "autoOpenCashDrawer" BOOLEAN NOT NULL DEFAULT true;
