-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "memberCode" TEXT,
ADD COLUMN "address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_memberCode_key" ON "Customer"("memberCode");

-- One-time cleanup approved before importing the real member list.
DELETE FROM "Customer" WHERE "isMember" = true;
