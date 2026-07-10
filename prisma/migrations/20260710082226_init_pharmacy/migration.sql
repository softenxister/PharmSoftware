-- CreateEnum
CREATE TYPE "PurchaseBillStatus" AS ENUM ('RECEIVED', 'DRAFT', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PAID', 'PENDING', 'VOIDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'THB');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "packUnit" TEXT NOT NULL,
    "childUnit" TEXT NOT NULL,
    "childQuantity" DECIMAL(14,3) NOT NULL,
    "packLabel" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "weeklySold" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductParentPack" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packUnit" TEXT NOT NULL,
    "childPackUnit" TEXT NOT NULL,
    "childPackQuantity" DECIMAL(14,3) NOT NULL,
    "label" TEXT NOT NULL,
    "priceMultiplier" DECIMAL(14,3) NOT NULL,
    "barcode" TEXT,

    CONSTRAINT "ProductParentPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "sellPriceThb" DECIMAL(14,2) NOT NULL,
    "availableStock" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "avatarUrl" TEXT,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "membershipRank" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFavoriteProduct" (
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CustomerFavoriteProduct_pkey" PRIMARY KEY ("customerId","productId")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pharmacist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pharmacist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseBill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "distributorId" TEXT,
    "distributorName" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "totalQty" DECIMAL(14,3) NOT NULL,
    "netTotal" DECIMAL(14,2) NOT NULL,
    "status" "PurchaseBillStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseBillId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitMultiplier" DECIMAL(14,3) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "freeUnit" TEXT NOT NULL,
    "freeUnitMultiplier" DECIMAL(14,3) NOT NULL,
    "freeQuantity" DECIMAL(14,3) NOT NULL,
    "batchNo" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "itemCount" INTEGER NOT NULL,
    "totalQuantity" DECIMAL(14,3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "purchaseMethod" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "netTotal" DECIMAL(14,2) NOT NULL,
    "customerPaid" DECIMAL(14,2),
    "changeDue" DECIMAL(14,2),
    "status" "SaleStatus" NOT NULL,
    "ownerId" TEXT,
    "pharmacistId" TEXT,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "packLabel" TEXT NOT NULL,
    "packMultiplier" DECIMAL(14,3) NOT NULL,
    "location" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "sellPriceThb" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- CreateIndex
CREATE INDEX "Product_itemName_idx" ON "Product"("itemName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductParentPack_barcode_key" ON "ProductParentPack"("barcode");

-- CreateIndex
CREATE INDEX "ProductParentPack_productId_idx" ON "ProductParentPack"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductParentPack_productId_packUnit_key" ON "ProductParentPack"("productId", "packUnit");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_idx" ON "ProductBatch"("productId");

-- CreateIndex
CREATE INDEX "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_productId_batchNo_key" ON "ProductBatch"("productId", "batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_name_key" ON "Distributor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobile_key" ON "Customer"("mobile");

-- CreateIndex
CREATE INDEX "CustomerFavoriteProduct_productId_idx" ON "CustomerFavoriteProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseBill_billNo_key" ON "PurchaseBill"("billNo");

-- CreateIndex
CREATE INDEX "PurchaseBill_purchasedAt_idx" ON "PurchaseBill"("purchasedAt");

-- CreateIndex
CREATE INDEX "PurchaseBill_distributorId_idx" ON "PurchaseBill"("distributorId");

-- CreateIndex
CREATE INDEX "PurchaseLine_purchaseBillId_idx" ON "PurchaseLine"("purchaseBillId");

-- CreateIndex
CREATE INDEX "PurchaseLine_productId_idx" ON "PurchaseLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_billNo_key" ON "Sale"("billNo");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductParentPack" ADD CONSTRAINT "ProductParentPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFavoriteProduct" ADD CONSTRAINT "CustomerFavoriteProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFavoriteProduct" ADD CONSTRAINT "CustomerFavoriteProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "Pharmacist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
