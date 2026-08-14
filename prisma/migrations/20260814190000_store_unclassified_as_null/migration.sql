ALTER TABLE "Product"
  ALTER COLUMN "categoryId" DROP NOT NULL,
  ALTER COLUMN "dosageForm" DROP DEFAULT,
  ALTER COLUMN "dosageForm" DROP NOT NULL;

UPDATE "Product"
SET "categoryId" = NULL
WHERE "categoryId" IN (
  SELECT id
  FROM "Category"
  WHERE LOWER(BTRIM(name)) = 'unclassified'
);

UPDATE "Product"
SET "dosageForm" = NULL
WHERE LOWER(BTRIM("dosageForm")) = 'unclassified';

DELETE FROM "Category" category
WHERE LOWER(BTRIM(category.name)) = 'unclassified'
  AND NOT EXISTS (
    SELECT 1
    FROM "Product" product
    WHERE product."categoryId" = category.id
  );
