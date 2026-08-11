-- Remove generated dictionary rows that represented a whole combination before
-- imported generic names were split into one ingredient per row.
DELETE FROM "Ingredient" ingredient
WHERE ingredient.id LIKE 'ingredient-imported-%'
  AND (
    ingredient."canonicalName" ~ '[+,;/&|]'
    OR ingredient."canonicalName" ~* '[[:space:]]+(and|และ)[[:space:]]+'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProductIngredient" verified
    WHERE verified."ingredientId" = ingredient.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProductImportedIngredient" imported
    WHERE imported."ingredientId" = ingredient.id
  );
