-- Rebuild imported ingredient links using every supported combination separator.
-- This prevents combinations such as "Sildenafil / Dapoxetine" from being stored
-- or classified as a single active ingredient.
WITH parsed AS (
  SELECT
    btrim(part."value") AS "sourceValue",
    btrim(regexp_replace(lower(btrim(part."value")), '[^[:alnum:]]+', ' ', 'g')) AS "normalizedName"
  FROM "Product" product
  CROSS JOIN LATERAL regexp_split_to_table(
    product."migrationGenericName",
    '[+,;/&|]|[[:space:]]+(and|และ)[[:space:]]+',
    'i'
  ) AS part("value")
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

DELETE FROM "ProductImportedIngredient";

WITH parsed AS (
  SELECT
    product."id" AS "productId",
    btrim(part."value") AS "sourceValue",
    btrim(regexp_replace(lower(btrim(part."value")), '[^[:alnum:]]+', ' ', 'g')) AS "normalizedName"
  FROM "Product" product
  CROSS JOIN LATERAL regexp_split_to_table(
    product."migrationGenericName",
    '[+,;/&|]|[[:space:]]+(and|และ)[[:space:]]+',
    'i'
  ) AS part("value")
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

-- Remove only obsolete generated combination values that no product references.
DELETE FROM "Ingredient" ingredient
WHERE ingredient.id LIKE 'ingredient-imported-%'
  AND ingredient."canonicalName" ~ '[+,;/&|]'
  AND NOT EXISTS (
    SELECT 1 FROM "ProductIngredient" verified
    WHERE verified."ingredientId" = ingredient.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProductImportedIngredient" imported
    WHERE imported."ingredientId" = ingredient.id
  );
