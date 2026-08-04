ALTER TABLE "Product"
ADD COLUMN "migrationGenericName" TEXT;

CREATE TABLE "ProductDataImportRun" (
    "id" TEXT NOT NULL,
    "sourceSoftware" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "changedCount" INTEGER NOT NULL,
    "unchangedCount" INTEGER NOT NULL,
    "unmatchedCount" INTEGER NOT NULL,
    "invalidCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDataImportRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductDataImportRun_mode_check"
      CHECK ("mode" IN ('generic-cost-update')),
    CONSTRAINT "ProductDataImportRun_source_file_hash_check"
      CHECK ("sourceFileHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "ProductDataImportRun_nonnegative_counts_check"
      CHECK (
        "changedCount" >= 0
        AND "unchangedCount" >= 0
        AND "unmatchedCount" >= 0
        AND "invalidCount" >= 0
      )
);

CREATE INDEX "ProductDataImportRun_createdAt_idx"
ON "ProductDataImportRun"("createdAt");
