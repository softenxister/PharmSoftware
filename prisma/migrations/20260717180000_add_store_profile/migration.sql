-- CreateTable
CREATE TABLE "StoreProfile" (
    "id" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "pharmacyLicense" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "lineId" TEXT NOT NULL DEFAULT '',
    "facebookPage" TEXT NOT NULL DEFAULT '',
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StoreProfile" (
    "id", "storeName", "updatedBy", "createdAt", "updatedAt"
) VALUES (
    'primary-store', 'RxPro Pharmacy', 'System migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
