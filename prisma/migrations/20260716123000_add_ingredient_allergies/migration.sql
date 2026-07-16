CREATE TYPE "ProductCompositionStatus" AS ENUM ('PENDING', 'VERIFIED', 'UNAVAILABLE', 'NOT_APPLICABLE');

ALTER TABLE "Product"
ADD COLUMN "compositionStatus" "ProductCompositionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "compositionCheckedAt" TIMESTAMP(3),
ADD COLUMN "compositionRetryAt" TIMESTAMP(3),
ADD COLUMN "compositionError" TEXT;

CREATE TABLE "Ingredient" (
  "id" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "thaiName" TEXT,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rxNormId" TEXT,
  "unii" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductIngredient" (
  "productId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "strength" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceRecordId" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("productId", "ingredientId")
);

CREATE TABLE "CustomerIngredientAllergy" (
  "customerId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerIngredientAllergy_pkey" PRIMARY KEY ("customerId", "ingredientId")
);

CREATE UNIQUE INDEX "Ingredient_canonicalName_key" ON "Ingredient"("canonicalName");
CREATE UNIQUE INDEX "Ingredient_normalizedName_key" ON "Ingredient"("normalizedName");
CREATE UNIQUE INDEX "Ingredient_rxNormId_key" ON "Ingredient"("rxNormId");
CREATE UNIQUE INDEX "Ingredient_unii_key" ON "Ingredient"("unii");
CREATE INDEX "Ingredient_canonicalName_idx" ON "Ingredient"("canonicalName");
CREATE INDEX "ProductIngredient_ingredientId_idx" ON "ProductIngredient"("ingredientId");
CREATE INDEX "CustomerIngredientAllergy_ingredientId_idx" ON "CustomerIngredientAllergy"("ingredientId");

ALTER TABLE "ProductIngredient"
ADD CONSTRAINT "ProductIngredient_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductIngredient"
ADD CONSTRAINT "ProductIngredient_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerIngredientAllergy"
ADD CONSTRAINT "CustomerIngredientAllergy_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerIngredientAllergy"
ADD CONSTRAINT "CustomerIngredientAllergy_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Ingredient" ("id", "canonicalName", "normalizedName", "thaiName", "aliases", "updatedAt") VALUES
  ('ingredient-paracetamol', 'Paracetamol', 'paracetamol', 'พาราเซตามอล', ARRAY['Acetaminophen'], CURRENT_TIMESTAMP),
  ('ingredient-cetirizine', 'Cetirizine', 'cetirizine', 'เซทิริซีน', ARRAY['Cetirizine hydrochloride'], CURRENT_TIMESTAMP),
  ('ingredient-simethicone', 'Simethicone', 'simethicone', 'ไซเมทิโคน', ARRAY['Simeticone'], CURRENT_TIMESTAMP),
  ('ingredient-sodium-alginate', 'Sodium alginate', 'sodium alginate', 'โซเดียมอัลจิเนต', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('ingredient-sodium-bicarbonate', 'Sodium bicarbonate', 'sodium bicarbonate', 'โซเดียมไบคาร์บอเนต', ARRAY['Sodium hydrogen carbonate'], CURRENT_TIMESTAMP),
  ('ingredient-calcium-carbonate', 'Calcium carbonate', 'calcium carbonate', 'แคลเซียมคาร์บอเนต', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('ingredient-povidone-iodine', 'Povidone-iodine', 'povidone iodine', 'โพวิโดน-ไอโอดีน', ARRAY['PVP-I', 'Povidone iodine'], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ProductIngredient" ("productId", "ingredientId", "strength", "sourceName", "sourceUrl")
SELECT seed."productId", seed."ingredientId", seed."strength", seed."sourceName", seed."sourceUrl"
FROM (VALUES
  ('p-sara', 'ingredient-paracetamol', '500 mg', 'Thai Nakorn Patana', 'https://www.thainakorn.com/product'),
  ('p-tylenol', 'ingredient-paracetamol', '500 mg', 'Tylenol', 'https://www.tylenol.com/products/headache-pain-relief/tylenol-easy-to-swallow'),
  ('p-zyrtec', 'ingredient-cetirizine', '10 mg', 'UCB', 'https://www.ucb.com/our-company/about-us'),
  ('p-airx', 'ingredient-simethicone', NULL, 'NLM RxNorm', 'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=simethicone&search=2'),
  ('p-gaviscon', 'ingredient-sodium-alginate', '500 mg per 10 ml', 'Gaviscon', 'https://www.gaviscon.co.uk/products/gaviscon-double-action-sachets/'),
  ('p-gaviscon', 'ingredient-sodium-bicarbonate', '213 mg per 10 ml', 'Gaviscon', 'https://www.gaviscon.co.uk/products/gaviscon-double-action-sachets/'),
  ('p-gaviscon', 'ingredient-calcium-carbonate', '325 mg per 10 ml', 'Gaviscon', 'https://www.gaviscon.co.uk/products/gaviscon-double-action-sachets/'),
  ('p-betadine', 'ingredient-povidone-iodine', '10%', 'Betadine', 'https://betadine.com/medical-professionals/betadine-solution/')
) AS seed("productId", "ingredientId", "strength", "sourceName", "sourceUrl")
WHERE EXISTS (SELECT 1 FROM "Product" product WHERE product."id" = seed."productId")
ON CONFLICT ("productId", "ingredientId") DO NOTHING;

UPDATE "Product"
SET "compositionStatus" = 'VERIFIED', "compositionCheckedAt" = CURRENT_TIMESTAMP, "compositionError" = NULL
WHERE "id" IN ('p-sara', 'p-tylenol', 'p-zyrtec', 'p-airx', 'p-gaviscon', 'p-betadine');

UPDATE "Product"
SET "compositionStatus" = 'NOT_APPLICABLE', "compositionCheckedAt" = CURRENT_TIMESTAMP, "compositionError" = NULL
WHERE "id" IN ('p-blackmores-c', 'p-natc', 'p-nexcare', 'p-smooth-e', 'p-nivea-sun', 'p-durex', 'p-dentiste');
