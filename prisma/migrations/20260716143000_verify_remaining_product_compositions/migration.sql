INSERT INTO "Ingredient" ("id", "canonicalName", "normalizedName", "thaiName", "aliases", "updatedAt") VALUES
  ('ingredient-acetylcysteine', 'Acetylcysteine', 'acetylcysteine', 'อะเซทิลซิสเทอีน', ARRAY['N-acetylcysteine', 'NAC'], CURRENT_TIMESTAMP),
  ('ingredient-chlorpheniramine', 'Chlorpheniramine', 'chlorpheniramine', 'คลอร์เฟนิรามีน', ARRAY['Chlorpheniramine maleate'], CURRENT_TIMESTAMP),
  ('ingredient-phenylephrine', 'Phenylephrine', 'phenylephrine', 'ฟีนิลเอฟรีน', ARRAY['Phenylephrine hydrochloride', 'Phenylephrine HCl'], CURRENT_TIMESTAMP),
  ('ingredient-glucose', 'Glucose', 'glucose', 'กลูโคส', ARRAY['Glucose anhydrous', 'Anhydrous glucose'], CURRENT_TIMESTAMP),
  ('ingredient-sodium-chloride', 'Sodium chloride', 'sodium chloride', 'โซเดียมคลอไรด์', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('ingredient-sodium-citrate', 'Sodium citrate', 'sodium citrate', 'โซเดียมซิเตรต', ARRAY['Sodium citrate dihydrate', 'Trisodium citrate dihydrate'], CURRENT_TIMESTAMP),
  ('ingredient-potassium-chloride', 'Potassium chloride', 'potassium chloride', 'โพแทสเซียมคลอไรด์', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('ingredient-phenyl-salicylate', 'Phenyl salicylate', 'phenyl salicylate', 'ฟีนิลซาลิไซเลต', ARRAY['Salol'], CURRENT_TIMESTAMP),
  ('ingredient-menthol', 'Menthol', 'menthol', 'เมนทอล', ARRAY[]::TEXT[], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ProductIngredient" (
  "productId",
  "ingredientId",
  "strength",
  "sourceName",
  "sourceRecordId",
  "sourceUrl"
)
SELECT seed."productId", seed."ingredientId", seed."strength", seed."sourceName", seed."sourceRecordId", seed."sourceUrl"
FROM (VALUES
  (
    'p-nac-long-600-mg-10-s-932604',
    'ingredient-acetylcysteine',
    '600 mg per effervescent tablet',
    'Thai FDA National Drug Information',
    '1C 57/49',
    'https://ndi.fda.moph.go.th/drug_info/index?name=acetylcysteine&per_page=12'
  ),
  (
    'p-tiffy',
    'ingredient-chlorpheniramine',
    '2 mg per tablet',
    'Thai FDA National Drug Information',
    '2A 3/52',
    'https://ndi.fda.moph.go.th/drug_info_corporation/char/T/552'
  ),
  (
    'p-tiffy',
    'ingredient-paracetamol',
    '500 mg per tablet',
    'Thai FDA National Drug Information',
    '2A 3/52',
    'https://ndi.fda.moph.go.th/drug_info_corporation/char/T/552'
  ),
  (
    'p-tiffy',
    'ingredient-phenylephrine',
    '10 mg per tablet',
    'Thai FDA National Drug Information',
    '2A 3/52',
    'https://ndi.fda.moph.go.th/drug_info_corporation/char/T/552'
  ),
  (
    'p-ors',
    'ingredient-glucose',
    '3.375 g per 5.5 g sachet',
    'Thai FDA',
    '2A 78/65',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022650007811C'
  ),
  (
    'p-ors',
    'ingredient-sodium-chloride',
    '0.650 g per 5.5 g sachet',
    'Thai FDA',
    '2A 78/65',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022650007811C'
  ),
  (
    'p-ors',
    'ingredient-sodium-citrate',
    '0.725 g per 5.5 g sachet',
    'Thai FDA',
    '2A 78/65',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022650007811C'
  ),
  (
    'p-ors',
    'ingredient-potassium-chloride',
    '0.375 g per 5.5 g sachet',
    'Thai FDA',
    '2A 78/65',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022650007811C'
  ),
  (
    'p-stock-item-625204',
    'ingredient-phenyl-salicylate',
    '20 mg per ml',
    'Thai FDA',
    '2A 83/66',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022660008311C'
  ),
  (
    'p-stock-item-625204',
    'ingredient-menthol',
    '1.56 mg per ml',
    'Thai FDA',
    '2A 83/66',
    'https://pertento.fda.moph.go.th/FDA_SEARCH_DRUG/SEARCH_DRUG/pop-up_drug.aspx?Newcode_U=U1DR2A1022660008311C'
  )
) AS seed("productId", "ingredientId", "strength", "sourceName", "sourceRecordId", "sourceUrl")
WHERE EXISTS (SELECT 1 FROM "Product" product WHERE product."id" = seed."productId")
ON CONFLICT ("productId", "ingredientId") DO UPDATE SET
  "strength" = EXCLUDED."strength",
  "sourceName" = EXCLUDED."sourceName",
  "sourceRecordId" = EXCLUDED."sourceRecordId",
  "sourceUrl" = EXCLUDED."sourceUrl",
  "verifiedAt" = CURRENT_TIMESTAMP;

UPDATE "Product"
SET
  "compositionStatus" = 'VERIFIED',
  "compositionCheckedAt" = CURRENT_TIMESTAMP,
  "compositionRetryAt" = NULL,
  "compositionError" = NULL
WHERE "id" IN (
  'p-nac-long-600-mg-10-s-932604',
  'p-stock-item-625204',
  'p-tiffy',
  'p-ors'
);
