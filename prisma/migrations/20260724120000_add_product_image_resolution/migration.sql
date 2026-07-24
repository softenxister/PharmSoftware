DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductImageResolutionStatus') THEN
    CREATE TYPE "ProductImageResolutionStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVIEW', 'UNRESOLVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductIdentifierType') THEN
    CREATE TYPE "ProductIdentifierType" AS ENUM ('GTIN', 'NDC', 'THAI_FDA_REGISTRATION', 'RXCUI', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductImageCandidateStatus') THEN
    CREATE TYPE "ProductImageCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "imageResolutionStatus" "ProductImageResolutionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "imageCheckedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imageRetryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imageResolutionError" TEXT;

CREATE TABLE IF NOT EXISTS "ProductIdentifier" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "ProductIdentifierType" NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "market" TEXT NOT NULL DEFAULT '',
  "packageLevel" TEXT NOT NULL DEFAULT '',
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductImageCandidate" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" "ProductImageCandidateStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL,
  "sourcePageUrl" TEXT NOT NULL,
  "sourceImageUrl" TEXT NOT NULL,
  "sourceLicence" TEXT NOT NULL,
  "matchMethod" TEXT NOT NULL,
  "sourceIdentifierType" TEXT,
  "sourceIdentifierValue" TEXT,
  "sourceProductName" TEXT,
  "sourceBrand" TEXT,
  "sourceManufacturer" TEXT,
  "sourceMarket" TEXT,
  "evidence" JSONB NOT NULL,
  "score" INTEGER NOT NULL,
  "autoPublishEligible" BOOLEAN NOT NULL DEFAULT false,
  "imageMimeType" TEXT,
  "imageWidth" INTEGER,
  "imageHeight" INTEGER,
  "imageByteSize" INTEGER,
  "rejectionReason" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductImageCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductImageAsset" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourcePageUrl" TEXT NOT NULL,
  "sourceImageUrl" TEXT NOT NULL,
  "sourceLicence" TEXT NOT NULL,
  "matchedIdentifierType" TEXT,
  "matchedIdentifierValue" TEXT,
  "evidence" JSONB NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductIdentifier_type_normalizedValue_market_packageLevel_key"
  ON "ProductIdentifier"("type", "normalizedValue", "market", "packageLevel");
CREATE INDEX IF NOT EXISTS "ProductIdentifier_productId_idx"
  ON "ProductIdentifier"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductImageCandidate_productId_provider_sourceImageUrl_key"
  ON "ProductImageCandidate"("productId", "provider", "sourceImageUrl");
CREATE INDEX IF NOT EXISTS "ProductImageCandidate_status_score_createdAt_id_idx"
  ON "ProductImageCandidate"("status", "score", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "ProductImageCandidate_productId_status_idx"
  ON "ProductImageCandidate"("productId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductImageAsset_productId_key"
  ON "ProductImageAsset"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductImageAsset_candidateId_key"
  ON "ProductImageAsset"("candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductImageAsset_storageKey_key"
  ON "ProductImageAsset"("storageKey");
CREATE INDEX IF NOT EXISTS "ProductImageAsset_sha256_idx"
  ON "ProductImageAsset"("sha256");
CREATE INDEX IF NOT EXISTS "Product_imageResolutionStatus_imageRetryAt_id_idx"
  ON "Product"("imageResolutionStatus", "imageRetryAt", "id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductIdentifier_productId_fkey') THEN
    ALTER TABLE "ProductIdentifier"
      ADD CONSTRAINT "ProductIdentifier_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductImageCandidate_productId_fkey') THEN
    ALTER TABLE "ProductImageCandidate"
      ADD CONSTRAINT "ProductImageCandidate_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductImageAsset_productId_fkey') THEN
    ALTER TABLE "ProductImageAsset"
      ADD CONSTRAINT "ProductImageAsset_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductImageAsset_candidateId_fkey') THEN
    ALTER TABLE "ProductImageAsset"
      ADD CONSTRAINT "ProductImageAsset_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "ProductImageCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
