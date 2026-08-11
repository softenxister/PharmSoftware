CREATE TABLE "ProductImportedIngredient" (
  "productId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImportedIngredient_pkey" PRIMARY KEY ("productId", "ingredientId")
);

CREATE INDEX "ProductImportedIngredient_ingredientId_idx"
ON "ProductImportedIngredient"("ingredientId");

ALTER TABLE "ProductImportedIngredient"
ADD CONSTRAINT "ProductImportedIngredient_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductImportedIngredient"
ADD CONSTRAINT "ProductImportedIngredient_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH parsed AS (
  SELECT
    product."id" AS "productId",
    btrim(part."value") AS "sourceValue",
    btrim(regexp_replace(lower(btrim(part."value")), '[^[:alnum:]]+', ' ', 'g')) AS "normalizedName"
  FROM "Product" product
  CROSS JOIN LATERAL regexp_split_to_table(product."migrationGenericName", '[+,]') AS part("value")
  WHERE product."migrationGenericName" IS NOT NULL
    AND btrim(part."value") <> ''
), unresolved AS (
  SELECT DISTINCT ON (parsed."normalizedName")
    parsed."sourceValue",
    parsed."normalizedName"
  FROM parsed
  WHERE parsed."normalizedName" <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM "Ingredient" ingredient
      WHERE ingredient."normalizedName" = parsed."normalizedName"
        OR EXISTS (
          SELECT 1
          FROM unnest(ingredient."aliases") alias
          WHERE btrim(regexp_replace(lower(alias), '[^[:alnum:]]+', ' ', 'g')) = parsed."normalizedName"
        )
    )
  ORDER BY parsed."normalizedName", parsed."sourceValue"
)
INSERT INTO "Ingredient" (
  "id", "canonicalName", "normalizedName", "aliases", "updatedAt"
)
SELECT
  'ingredient-imported-' || md5(unresolved."normalizedName"),
  initcap(unresolved."sourceValue"),
  unresolved."normalizedName",
  ARRAY[]::TEXT[],
  CURRENT_TIMESTAMP
FROM unresolved
ON CONFLICT DO NOTHING;

WITH parsed AS (
  SELECT
    product."id" AS "productId",
    btrim(part."value") AS "sourceValue",
    btrim(regexp_replace(lower(btrim(part."value")), '[^[:alnum:]]+', ' ', 'g')) AS "normalizedName"
  FROM "Product" product
  CROSS JOIN LATERAL regexp_split_to_table(product."migrationGenericName", '[+,]') AS part("value")
  WHERE product."migrationGenericName" IS NOT NULL
    AND btrim(part."value") <> ''
), resolved AS (
  SELECT
    parsed."productId",
    parsed."sourceValue",
    match."id" AS "ingredientId"
  FROM parsed
  CROSS JOIN LATERAL (
    SELECT ingredient."id"
    FROM "Ingredient" ingredient
    WHERE ingredient."normalizedName" = parsed."normalizedName"
      OR EXISTS (
        SELECT 1
        FROM unnest(ingredient."aliases") alias
        WHERE btrim(regexp_replace(lower(alias), '[^[:alnum:]]+', ' ', 'g')) = parsed."normalizedName"
      )
    ORDER BY (ingredient."normalizedName" = parsed."normalizedName") DESC, ingredient."id"
    LIMIT 1
  ) match
  WHERE parsed."normalizedName" <> ''
)
INSERT INTO "ProductImportedIngredient" (
  "productId", "ingredientId", "sourceName", "sourceValue", "updatedAt"
)
SELECT DISTINCT ON (resolved."productId", resolved."ingredientId")
  resolved."productId",
  resolved."ingredientId",
  'CW stock import',
  resolved."sourceValue",
  CURRENT_TIMESTAMP
FROM resolved
ORDER BY resolved."productId", resolved."ingredientId", resolved."sourceValue"
ON CONFLICT ("productId", "ingredientId") DO UPDATE SET
  "sourceName" = EXCLUDED."sourceName",
  "sourceValue" = EXCLUDED."sourceValue",
  "updatedAt" = CURRENT_TIMESTAMP;
