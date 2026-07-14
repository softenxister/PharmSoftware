-- CreateTable
CREATE TABLE "StorePosSettings" (
    "id" TEXT NOT NULL,
    "showProductLocation" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethods" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePosSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the single-store defaults used by this installation.
INSERT INTO "StorePosSettings" (
    "id", "showProductLocation", "paymentMethods", "updatedBy", "createdAt", "updatedAt"
) VALUES (
    'primary-store', false, '["Cash", "Mobile payment", "Credit card"]'::jsonb, 'System migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
