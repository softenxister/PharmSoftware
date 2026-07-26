ALTER TABLE "ProductImageAsset"
  DROP CONSTRAINT IF EXISTS "ProductImageAsset_candidateId_fkey";

DROP INDEX IF EXISTS "ProductImageAsset_candidateId_key";
DROP INDEX IF EXISTS "Product_imageResolutionStatus_imageRetryAt_id_idx";

ALTER TABLE "ProductImageAsset"
  DROP COLUMN IF EXISTS "candidateId",
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "sourcePageUrl",
  DROP COLUMN IF EXISTS "sourceLicence",
  DROP COLUMN IF EXISTS "matchedIdentifierType",
  DROP COLUMN IF EXISTS "matchedIdentifierValue",
  DROP COLUMN IF EXISTS "evidence",
  DROP COLUMN IF EXISTS "verifiedAt",
  DROP COLUMN IF EXISTS "reviewedBy";

DROP TABLE IF EXISTS "ProductImageCandidate";
DROP TABLE IF EXISTS "ProductIdentifier";

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "imageResolutionStatus",
  DROP COLUMN IF EXISTS "imageCheckedAt",
  DROP COLUMN IF EXISTS "imageRetryAt",
  DROP COLUMN IF EXISTS "imageResolutionError";

DROP TYPE IF EXISTS "ProductImageCandidateStatus";
DROP TYPE IF EXISTS "ProductImageResolutionStatus";
DROP TYPE IF EXISTS "ProductIdentifierType";
