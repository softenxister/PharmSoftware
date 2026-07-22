-- Keep deprecated, overly specific unit identifiers out of persisted unit fields.
-- The application localizes these language-neutral replacements at display time.
CREATE FUNCTION pg_temp.normalize_product_unit(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(value)) IN ('caplet', 'caplets') OR trim(value) = 'เม็ดรี' THEN 'tablet'
    WHEN lower(trim(value)) IN ('container', 'containers') OR trim(value) = 'ภาชนะ' THEN 'jar'
    WHEN lower(trim(value)) IN ('vial', 'vials') OR trim(value) = 'ขวดไวอัล' THEN 'bottle'
    WHEN lower(trim(value)) IN ('pen', 'pens', 'pen.') OR trim(value) = 'ปากกา' THEN 'piece'
    WHEN lower(trim(value)) IN ('ampoule', 'ampoules', 'ampule', 'ampules') OR trim(value) = 'แอมพูล' THEN 'bottle'
    WHEN lower(trim(value)) IN ('syringe', 'syringes') OR trim(value) = 'กระบอกฉีดยา' THEN 'piece'
    WHEN lower(trim(value)) IN ('strip', 'strips') OR trim(value) = 'แถบ' THEN 'blisterpack'
    WHEN lower(trim(value)) IN ('drop', 'drops') OR trim(value) = 'หยด' THEN 'bottle'
    WHEN lower(trim(value)) IN ('dose', 'doses') OR trim(value) = 'โดส' THEN 'piece'
    WHEN lower(trim(value)) IN ('puff', 'puffs') OR trim(value) = 'ครั้ง' THEN 'piece'
    WHEN lower(trim(value)) IN ('spray', 'sprays') OR trim(value) = 'สเปรย์' THEN 'bottle'
    WHEN lower(trim(value)) IN ('patch', 'patches') OR trim(value) = 'แผ่นแปะ' THEN 'sheet'
    WHEN lower(trim(value)) IN ('suppository', 'suppositories') OR trim(value) = 'ยาเหน็บ' THEN 'piece'
    WHEN lower(trim(value)) IN ('mg', 'mcg') OR trim(value) IN ('มก', 'มก.', 'มคก', 'มคก.') THEN 'piece'
    WHEN lower(trim(value)) = 'cc' OR trim(value) = 'ซีซี' THEN 'ml'
    ELSE trim(value)
  END;
$$;

UPDATE "Product"
SET
  "packUnit" = pg_temp.normalize_product_unit("packUnit"),
  "childUnit" = pg_temp.normalize_product_unit("childUnit");

UPDATE "ProductParentPack"
SET
  "packUnit" = pg_temp.normalize_product_unit("packUnit"),
  "childPackUnit" = pg_temp.normalize_product_unit("childPackUnit");

UPDATE "PurchaseLine"
SET
  "unit" = pg_temp.normalize_product_unit("unit"),
  "freeUnit" = pg_temp.normalize_product_unit("freeUnit");
