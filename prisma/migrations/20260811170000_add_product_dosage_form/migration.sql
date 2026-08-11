CREATE TYPE "ProductDosageFormSource" AS ENUM ('INFERRED', 'THAI_FDA', 'MANUAL');

ALTER TABLE "Product"
ADD COLUMN "dosageForm" TEXT NOT NULL DEFAULT 'Unclassified',
ADD COLUMN "dosageFormSource" "ProductDosageFormSource" NOT NULL DEFAULT 'INFERRED';

WITH dosage_evidence AS (
  SELECT
    product.id,
    LOWER(product."itemName") AS item_text,
    LOWER(COALESCE(product."migrationGenericName", '')) AS generic_text,
    LOWER(category.name) AS category_name,
    product."childUnit",
    (
      NULLIF(BTRIM(product."migrationGenericName"), '') IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM "ProductIngredient" verified
        WHERE verified."productId" = product.id
      )
      OR EXISTS (
        SELECT 1 FROM "ProductImportedIngredient" imported
        WHERE imported."productId" = product.id
      )
    ) AS has_ingredient_evidence
  FROM "Product" product
  INNER JOIN "Category" category ON category.id = product."categoryId"
),
dosage_matches AS (
  SELECT
    evidence.*,
    CASE
      WHEN item_text ~* '(dry[[:space:]]+powder[[:space:]]+spray|powder[[:space:]]+spray)' THEN 'Spray'
      WHEN item_text ~* '(solution[[:space:]]+for[[:space:]]+inhalation|inhalation[[:space:]]+solution|nebuliz(er|ation)[[:space:]]+solution)' THEN 'Inhaler'
      WHEN item_text ~* 'powder[[:space:]]+for[[:space:]]+(oral[[:space:]]+)?suspension' THEN 'Suspension'
      WHEN item_text ~* '(powder|solution)[[:space:]]+for[[:space:]]+injection' THEN 'Injection'
      ELSE NULL
    END AS compound_form,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(tablets?|tabs?\.?|caplets?|lozenges?|troches?)($|[^[:alpha:]])' OR item_text LIKE '%เม็ด%' OR item_text LIKE '%ยาอม%' THEN 'Tablet' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(capsules?|caps?\.?)($|[^[:alpha:]])' OR item_text LIKE '%แคปซูล%' THEN 'Capsule' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(powders?|pwd\.?|granules?|gran\.?)($|[^[:alpha:]])' OR item_text LIKE '%ชนิดผง%' OR item_text LIKE '%ผงยา%' OR item_text LIKE '%ชนิดเกล็ด%' THEN 'Powder' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])syrups?($|[^[:alpha:]])' OR item_text LIKE '%น้ำเชื่อม%' OR item_text LIKE '%ไซรัป%' THEN 'Syrup' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(suspensions?|susp\.?)($|[^[:alpha:]])' OR item_text LIKE '%แขวนตะกอน%' THEN 'Suspension' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(solutions?|soln\.?|elixirs?|emulsions?|gargles?|enemas?)($|[^[:alpha:]])' OR item_text LIKE '%ยาน้ำรับประทาน%' OR item_text LIKE '%ยากลั้วคอ%' OR item_text LIKE '%ยาสวน%' THEN 'Solution' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(drops?|e[[:space:]]*/[[:space:]]*d\.?)($|[^[:alpha:]])' OR item_text LIKE '%ชนิดหยด%' OR item_text LIKE '%ยาหยอด%' OR item_text LIKE '%หยอดตา%' OR item_text LIKE '%หยอดหู%' THEN 'Drops' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])creams?($|[^[:alpha:]])' OR item_text LIKE '%ครีม%' THEN 'Cream' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(ointments?|oint\.?|pastes?|balms?)($|[^[:alpha:]])' OR item_text LIKE '%ขี้ผึ้ง%' OR item_text LIKE '%ยาหม่อง%' THEN 'Ointment' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])gels?($|[^[:alpha:]])' OR item_text LIKE '%เจล%' THEN 'Gel' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(lotions?|shampoos?|medicated[[:space:]]+oils?)($|[^[:alpha:]])' OR item_text LIKE '%โลชั่น%' OR item_text LIKE '%แชมพู%' THEN 'Lotion' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])sprays?($|[^[:alpha:]])' OR item_text LIKE '%สเปรย์%' THEN 'Spray' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(inhalers?|mdi)($|[^[:alpha:]])' OR item_text LIKE '%ยาสูด%' OR item_text LIKE '%ยาดม%' OR item_text LIKE '%น้ำยาพ่น%' THEN 'Inhaler' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(injections?|injectable|inj\.?)($|[^[:alpha:]])' OR item_text LIKE '%ยาฉีด%' THEN 'Injection' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(suppositor(y|ies)|pessar(y|ies))($|[^[:alpha:]])' OR item_text LIKE '%ยาเหน็บ%' THEN 'Suppository' END,
      CASE WHEN item_text ~* '(^|[^[:alpha:]])(patch(es)?|transdermal)($|[^[:alpha:]])' OR item_text LIKE '%แผ่นแปะ%' THEN 'Patch' END
    ]::text[], NULL) AS item_forms,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(tablets?|tabs?\.?|caplets?|lozenges?|troches?)($|[^[:alpha:]])' OR generic_text LIKE '%เม็ด%' OR generic_text LIKE '%ยาอม%' THEN 'Tablet' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(capsules?|caps?\.?)($|[^[:alpha:]])' OR generic_text LIKE '%แคปซูล%' THEN 'Capsule' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(powders?|pwd\.?|granules?|gran\.?)($|[^[:alpha:]])' OR generic_text LIKE '%ชนิดผง%' OR generic_text LIKE '%ผงยา%' OR generic_text LIKE '%ชนิดเกล็ด%' THEN 'Powder' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])syrups?($|[^[:alpha:]])' OR generic_text LIKE '%น้ำเชื่อม%' OR generic_text LIKE '%ไซรัป%' THEN 'Syrup' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(suspensions?|susp\.?)($|[^[:alpha:]])' OR generic_text LIKE '%แขวนตะกอน%' THEN 'Suspension' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(solutions?|soln\.?|elixirs?|emulsions?|gargles?|enemas?)($|[^[:alpha:]])' OR generic_text LIKE '%ยาน้ำรับประทาน%' OR generic_text LIKE '%ยากลั้วคอ%' OR generic_text LIKE '%ยาสวน%' THEN 'Solution' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(drops?|e[[:space:]]*/[[:space:]]*d\.?)($|[^[:alpha:]])' OR generic_text LIKE '%ชนิดหยด%' OR generic_text LIKE '%ยาหยอด%' OR generic_text LIKE '%หยอดตา%' OR generic_text LIKE '%หยอดหู%' THEN 'Drops' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])creams?($|[^[:alpha:]])' OR generic_text LIKE '%ครีม%' THEN 'Cream' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(ointments?|oint\.?|pastes?|balms?)($|[^[:alpha:]])' OR generic_text LIKE '%ขี้ผึ้ง%' OR generic_text LIKE '%ยาหม่อง%' THEN 'Ointment' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])gels?($|[^[:alpha:]])' OR generic_text LIKE '%เจล%' THEN 'Gel' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(lotions?|shampoos?|medicated[[:space:]]+oils?)($|[^[:alpha:]])' OR generic_text LIKE '%โลชั่น%' OR generic_text LIKE '%แชมพู%' THEN 'Lotion' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])sprays?($|[^[:alpha:]])' OR generic_text LIKE '%สเปรย์%' THEN 'Spray' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(inhalers?|mdi)($|[^[:alpha:]])' OR generic_text LIKE '%ยาสูด%' OR generic_text LIKE '%ยาดม%' OR generic_text LIKE '%น้ำยาพ่น%' THEN 'Inhaler' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(injections?|injectable|inj\.?)($|[^[:alpha:]])' OR generic_text LIKE '%ยาฉีด%' THEN 'Injection' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(suppositor(y|ies)|pessar(y|ies))($|[^[:alpha:]])' OR generic_text LIKE '%ยาเหน็บ%' THEN 'Suppository' END,
      CASE WHEN generic_text ~* '(^|[^[:alpha:]])(patch(es)?|transdermal)($|[^[:alpha:]])' OR generic_text LIKE '%แผ่นแปะ%' THEN 'Patch' END
    ]::text[], NULL) AS generic_forms
  FROM dosage_evidence evidence
),
selected_dosage AS (
  SELECT
    matches.*,
    CASE WHEN CARDINALITY(item_forms) > 0 THEN item_forms ELSE generic_forms END AS forms
  FROM dosage_matches matches
),
resolved_dosage AS (
  SELECT
    id,
    CASE
      WHEN category_name IN ('personal care & cosmetics', 'medical devices & diagnostics')
        AND NOT has_ingredient_evidence
        AND NOT (forms && ARRAY['Syrup', 'Suspension', 'Injection', 'Suppository']::text[])
        THEN 'Not Applicable'
      WHEN compound_form IS NOT NULL THEN compound_form
      WHEN CARDINALITY(forms) = 1 THEN forms[1]
      WHEN CARDINALITY(forms) > 1 THEN 'Unclassified'
      WHEN LOWER(BTRIM("childUnit")) IN ('tablet', 'เม็ด') THEN 'Tablet'
      WHEN LOWER(BTRIM("childUnit")) IN ('capsule', 'แคปซูล') THEN 'Capsule'
      ELSE 'Unclassified'
    END AS dosage_form
  FROM selected_dosage
)
UPDATE "Product" product
SET "dosageForm" = resolved.dosage_form
FROM resolved_dosage resolved
WHERE resolved.id = product.id;

WITH solid_unit_corrections AS (
  SELECT
    id,
    CASE
      WHEN "childUnit" IN ('tablet', 'capsule') AND "dosageForm" = 'Tablet' THEN 'tablet'
      WHEN "childUnit" IN ('tablet', 'capsule') AND "dosageForm" = 'Capsule' THEN 'capsule'
      WHEN "childUnit" IN ('เม็ด', 'แคปซูล') AND "dosageForm" = 'Tablet' THEN 'tablet'
      WHEN "childUnit" IN ('เม็ด', 'แคปซูล') AND "dosageForm" = 'Capsule' THEN 'capsule'
      ELSE "childUnit"
    END AS corrected_unit
  FROM "Product"
)
UPDATE "Product" product
SET
  "childUnit" = corrections.corrected_unit,
  "packLabel" = TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM product."childQuantity"::text))
    || ' ' || corrections.corrected_unit
FROM solid_unit_corrections corrections
WHERE corrections.id = product.id
  AND corrections.corrected_unit <> product."childUnit";

ALTER TABLE "Product"
ADD CONSTRAINT "Product_dosage_form_check"
CHECK ("dosageForm" IN (
  'Tablet', 'Capsule', 'Powder', 'Syrup', 'Suspension', 'Solution', 'Drops',
  'Cream', 'Ointment', 'Gel', 'Lotion', 'Spray', 'Inhaler', 'Injection',
  'Suppository', 'Patch', 'Not Applicable', 'Unclassified'
));

CREATE INDEX "Product_isActive_dosageForm_itemName_id_idx"
ON "Product" ("isActive", "dosageForm", "itemName", id);
