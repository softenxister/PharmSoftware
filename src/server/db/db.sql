-- Thailand retail pharmacy POS/inventory seed data.
-- Run with: psql "$DATABASE_URL" -f database/seed_thai_pharmacy.sql
--
-- Notes:
-- 1. Barcodes and internal SKUs are sample seed data. Replace with verified GS1/supplier data before production.
-- 2. Image URLs are stable PNG placeholder product labels for development. Replace with licensed product packshots later.
-- 3. This script recreates the seed schema so it is convenient for local development.

BEGIN;

DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_unit_conversions CASCADE;
DROP TABLE IF EXISTS product_units CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS manufacturers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE manufacturers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  website_url TEXT
);

CREATE TABLE products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  manufacturer_id BIGINT NOT NULL REFERENCES manufacturers(id),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  dosage_form TEXT,
  strength TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_units (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_sku TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL UNIQUE,
  packaging_type TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  cost_thb NUMERIC(12, 2) NOT NULL CHECK (cost_thb >= 0),
  sell_price_thb NUMERIC(12, 2) NOT NULL CHECK (sell_price_thb >= 0),
  weight NUMERIC(12, 3),
  weight_unit TEXT,
  is_base_unit BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_purchase_unit BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_sale_unit BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_unit_conversions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  parent_product_unit_id BIGINT NOT NULL REFERENCES product_units(id) ON DELETE CASCADE,
  child_product_unit_id BIGINT NOT NULL REFERENCES product_units(id) ON DELETE CASCADE,
  unit_conversion NUMERIC(12, 4) NOT NULL CHECK (unit_conversion > 0),
  conversion_note TEXT NOT NULL,
  UNIQUE (parent_product_unit_id, child_product_unit_id),
  CHECK (parent_product_unit_id <> child_product_unit_id)
);

CREATE TABLE product_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_unit_id BIGINT REFERENCES product_units(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_manufacturer_id ON products(manufacturer_id);
CREATE INDEX idx_product_units_product_id ON product_units(product_id);
CREATE INDEX idx_product_units_barcode ON product_units(barcode);
CREATE INDEX idx_product_unit_conversions_product_id ON product_unit_conversions(product_id);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);

INSERT INTO categories (name, description) VALUES
  ('Pain Relief', 'OTC analgesics and fever reducers'),
  ('Allergy & Cold', 'Cold, flu, cough, and allergy products'),
  ('Gastrointestinal', 'Digestive, antacid, gas relief, and rehydration products'),
  ('Vitamins & Supplements', 'Vitamins, minerals, and nutrition supplements'),
  ('First Aid', 'Wound care, plasters, antiseptics, and medical supplies'),
  ('Skincare', 'Dermatology, sun care, acne care, and cosmetic skincare'),
  ('Personal Care', 'Daily health and personal care products'),
  ('Oral Care', 'Toothpaste, mouthwash, and dental care products');

INSERT INTO manufacturers (name, country, website_url) VALUES
  ('Thai Nakorn Patana Co., Ltd.', 'Thailand', 'https://www.tnp.co.th'),
  ('Kenvue', 'United States', 'https://www.kenvue.com'),
  ('UCB Pharma', 'Belgium', 'https://www.ucb.com'),
  ('Bayer Thai Co., Ltd.', 'Thailand', 'https://www.bayer.com'),
  ('Takeda Thailand', 'Thailand', 'https://www.takeda.com'),
  ('Reckitt Benckiser Thailand', 'Thailand', 'https://www.reckitt.com'),
  ('Government Pharmaceutical Organization', 'Thailand', 'https://www.gpo.or.th'),
  ('Haleon Thailand', 'Thailand', 'https://www.haleon.com'),
  ('Blackmores Thailand', 'Thailand', 'https://www.blackmores.co.th'),
  ('Mega Lifesciences Public Company Limited', 'Thailand', 'https://www.megawecare.com'),
  ('Mundipharma Thailand', 'Thailand', 'https://www.mundipharma.com'),
  ('Berli Jucker Public Company Limited', 'Thailand', 'https://www.bjc.co.th'),
  ('3M Thailand Limited', 'Thailand', 'https://www.3m.co.th'),
  ('Medinova AG', 'Switzerland', 'https://www.medinova.ch'),
  ('Smooth E Co., Ltd.', 'Thailand', 'https://www.smoothe.com'),
  ('Beiersdorf Thailand', 'Thailand', 'https://www.nivea.co.th'),
  ('Siam Health Group Co., Ltd.', 'Thailand', 'https://www.siamhealthgroup.com');

INSERT INTO products (
  sku,
  item_name,
  brand_name,
  manufacturer_id,
  category_id,
  dosage_form,
  strength,
  description
) VALUES
  (
    'PRD-SARA-PARA-500',
    'Sara Paracetamol 500 mg Tablet',
    'Sara',
    (SELECT id FROM manufacturers WHERE name = 'Thai Nakorn Patana Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Pain Relief'),
    'Tablet',
    '500 mg',
    'Common Thai OTC paracetamol product for pain and fever relief.'
  ),
  (
    'PRD-TYLENOL-500',
    'Tylenol 500 mg Caplet',
    'Tylenol',
    (SELECT id FROM manufacturers WHERE name = 'Kenvue'),
    (SELECT id FROM categories WHERE name = 'Pain Relief'),
    'Caplet',
    '500 mg',
    'Paracetamol caplet commonly stocked by retail pharmacies.'
  ),
  (
    'PRD-TIFFY-DEY',
    'Tiffy Dey Cold Tablet',
    'Tiffy',
    (SELECT id FROM manufacturers WHERE name = 'Thai Nakorn Patana Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Allergy & Cold'),
    'Tablet',
    NULL,
    'OTC cold relief tablet commonly sold in Thai drug stores.'
  ),
  (
    'PRD-ZYRTEC-10',
    'Zyrtec Cetirizine 10 mg Tablet',
    'Zyrtec',
    (SELECT id FROM manufacturers WHERE name = 'UCB Pharma'),
    (SELECT id FROM categories WHERE name = 'Allergy & Cold'),
    'Tablet',
    '10 mg',
    'Cetirizine antihistamine for allergy symptoms.'
  ),
  (
    'PRD-CLARITYNE-10',
    'Clarityne Loratadine 10 mg Tablet',
    'Clarityne',
    (SELECT id FROM manufacturers WHERE name = 'Bayer Thai Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Allergy & Cold'),
    'Tablet',
    '10 mg',
    'Loratadine antihistamine for allergic rhinitis.'
  ),
  (
    'PRD-AIRX-CHEW',
    'Air-X Simethicone Chewable Tablet',
    'Air-X',
    (SELECT id FROM manufacturers WHERE name = 'Takeda Thailand'),
    (SELECT id FROM categories WHERE name = 'Gastrointestinal'),
    'Chewable tablet',
    NULL,
    'Simethicone gas relief tablet commonly found in Thai pharmacies.'
  ),
  (
    'PRD-GAVISCON-DA-SACHET',
    'Gaviscon Double Action Liquid Sachet',
    'Gaviscon',
    (SELECT id FROM manufacturers WHERE name = 'Reckitt Benckiser Thailand'),
    (SELECT id FROM categories WHERE name = 'Gastrointestinal'),
    'Liquid sachet',
    '10 ml',
    'Antacid and reflux relief liquid sachet.'
  ),
  (
    'PRD-OREDAR-ORS',
    'Oreda R.O. Oral Rehydration Salts Orange Sachet',
    'Oreda R.O.',
    (SELECT id FROM manufacturers WHERE name = 'Government Pharmaceutical Organization'),
    (SELECT id FROM categories WHERE name = 'Gastrointestinal'),
    'Powder sachet',
    NULL,
    'Oral rehydration salts for dehydration support.'
  ),
  (
    'PRD-ENO-LEMON',
    'ENO Lemon Fruit Salt Sachet',
    'ENO',
    (SELECT id FROM manufacturers WHERE name = 'Haleon Thailand'),
    (SELECT id FROM categories WHERE name = 'Gastrointestinal'),
    'Powder sachet',
    '5 g',
    'Effervescent antacid powder sachet.'
  ),
  (
    'PRD-BLACKMORES-BIOC-1000',
    'Blackmores Bio C 1000 Tablet',
    'Blackmores',
    (SELECT id FROM manufacturers WHERE name = 'Blackmores Thailand'),
    (SELECT id FROM categories WHERE name = 'Vitamins & Supplements'),
    'Tablet',
    '1000 mg',
    'Vitamin C supplement bottle.'
  ),
  (
    'PRD-NATC-1000',
    'MEGA We Care Nat C 1000 Tablet',
    'MEGA We Care',
    (SELECT id FROM manufacturers WHERE name = 'Mega Lifesciences Public Company Limited'),
    (SELECT id FROM categories WHERE name = 'Vitamins & Supplements'),
    'Tablet',
    '1000 mg',
    'Vitamin C supplement commonly sold in Thai pharmacies.'
  ),
  (
    'PRD-BEROCCA-PERF',
    'Berocca Performance Effervescent Tablet',
    'Berocca',
    (SELECT id FROM manufacturers WHERE name = 'Bayer Thai Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Vitamins & Supplements'),
    'Effervescent tablet',
    NULL,
    'Multivitamin effervescent tablet tube.'
  ),
  (
    'PRD-BETADINE-30ML',
    'Betadine Povidone-Iodine Solution 30 ml',
    'Betadine',
    (SELECT id FROM manufacturers WHERE name = 'Mundipharma Thailand'),
    (SELECT id FROM categories WHERE name = 'First Aid'),
    'Solution',
    '10% w/v, 30 ml',
    'Antiseptic wound cleansing solution.'
  ),
  (
    'PRD-TIGERPLAST-100',
    'Tigerplast Adhesive Plaster Box',
    'Tigerplast',
    (SELECT id FROM manufacturers WHERE name = 'Berli Jucker Public Company Limited'),
    (SELECT id FROM categories WHERE name = 'First Aid'),
    'Plaster',
    NULL,
    'Adhesive wound plaster box.'
  ),
  (
    'PRD-NEXCARE-WP-20',
    '3M Nexcare Waterproof Plaster',
    'Nexcare',
    (SELECT id FROM manufacturers WHERE name = '3M Thailand Limited'),
    (SELECT id FROM categories WHERE name = 'First Aid'),
    'Plaster',
    NULL,
    'Waterproof adhesive plaster.'
  ),
  (
    'PRD-HIRUDOID-20G',
    'Hirudoid Cream 20 g',
    'Hirudoid',
    (SELECT id FROM manufacturers WHERE name = 'Medinova AG'),
    (SELECT id FROM categories WHERE name = 'Skincare'),
    'Cream',
    '20 g',
    'Topical cream commonly stocked by pharmacies.'
  ),
  (
    'PRD-SMOOTHE-CREAM-15G',
    'Smooth E Cream 15 g',
    'Smooth E',
    (SELECT id FROM manufacturers WHERE name = 'Smooth E Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Skincare'),
    'Cream',
    '15 g',
    'Facial skincare cream popular in Thailand.'
  ),
  (
    'PRD-NIVEA-SUN-50ML',
    'Nivea Sun Protect & Moisture SPF50 50 ml',
    'Nivea',
    (SELECT id FROM manufacturers WHERE name = 'Beiersdorf Thailand'),
    (SELECT id FROM categories WHERE name = 'Skincare'),
    'Lotion',
    'SPF50, 50 ml',
    'Sunscreen lotion tube for daily sun protection.'
  ),
  (
    'PRD-DUREX-FETHERLITE-3',
    'Durex Fetherlite Condom 3 Pieces',
    'Durex',
    (SELECT id FROM manufacturers WHERE name = 'Reckitt Benckiser Thailand'),
    (SELECT id FROM categories WHERE name = 'Personal Care'),
    'Condom',
    '3 pieces',
    'Personal care condom pack.'
  ),
  (
    'PRD-DENTISTE-PLUSWHITE-100G',
    'Dentiste Plus White Toothpaste 100 g',
    'Dentiste',
    (SELECT id FROM manufacturers WHERE name = 'Siam Health Group Co., Ltd.'),
    (SELECT id FROM categories WHERE name = 'Oral Care'),
    'Toothpaste',
    '100 g',
    'Oral care toothpaste tube popular in Thai drug stores.'
  );

INSERT INTO product_units (
  product_id,
  unit_sku,
  barcode,
  packaging_type,
  unit_name,
  cost_thb,
  sell_price_thb,
  weight,
  weight_unit,
  is_base_unit,
  is_default_purchase_unit,
  is_default_sale_unit,
  sort_order
) VALUES
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), 'SARA-PARA-BOX-100', '8850001000014', 'Box', 'box', 280.00, 350.00, 100.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), 'SARA-PARA-BLISTER-10', 'INT-SARA-PCM-BL10-001', 'Blister pack', 'blister pack', 28.00, 40.00, 10.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), 'SARA-PARA-TAB-1', 'INT-SARA-PCM-TAB-001', 'Tablet', 'tablet', 2.80, 4.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), 'TYLENOL-BOX-100', '8850001000021', 'Box', 'box', 360.00, 450.00, 100.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), 'TYLENOL-BLISTER-10', 'INT-TYL-500-BL10-001', 'Blister pack', 'blister pack', 36.00, 48.00, 10.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), 'TYLENOL-CAPLET-1', 'INT-TYL-500-CPL-001', 'Caplet', 'caplet', 3.60, 5.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), 'TIFFY-DEY-BOX-100', '8850001000038', 'Box', 'box', 420.00, 550.00, 100.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), 'TIFFY-DEY-BLISTER-4', 'INT-TIFFY-DEY-BL4-001', 'Blister pack', 'blister pack', 16.80, 25.00, 4.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), 'TIFFY-DEY-TAB-1', 'INT-TIFFY-DEY-TAB-001', 'Tablet', 'tablet', 4.20, 7.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), 'ZYRTEC-BOX-10', '8850001000045', 'Box', 'box', 150.00, 220.00, 10.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), 'ZYRTEC-BLISTER-10', 'INT-ZYRTEC-10-BL10-001', 'Blister pack', 'blister pack', 150.00, 220.00, 10.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), 'ZYRTEC-TAB-1', 'INT-ZYRTEC-10-TAB-001', 'Tablet', 'tablet', 15.00, 25.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), 'CLARITYNE-BOX-10', '8850001000052', 'Box', 'box', 180.00, 260.00, 10.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), 'CLARITYNE-BLISTER-10', 'INT-CLARITYNE-BL10-001', 'Blister pack', 'blister pack', 180.00, 260.00, 10.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), 'CLARITYNE-TAB-1', 'INT-CLARITYNE-TAB-001', 'Tablet', 'tablet', 18.00, 30.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), 'AIRX-BOX-100', '8850001000069', 'Box', 'box', 210.00, 300.00, 100.000, 'tablet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), 'AIRX-BLISTER-10', 'INT-AIRX-BL10-001', 'Blister pack', 'blister pack', 21.00, 35.00, 10.000, 'tablet', FALSE, FALSE, TRUE, 2),
  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), 'AIRX-TAB-1', 'INT-AIRX-TAB-001', 'Tablet', 'tablet', 2.10, 4.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 3),

  ((SELECT id FROM products WHERE sku = 'PRD-GAVISCON-DA-SACHET'), 'GAVISCON-BOX-24', '8850001000076', 'Box', 'box', 250.00, 360.00, 24.000, 'sachet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-GAVISCON-DA-SACHET'), 'GAVISCON-SACHET-10ML', 'INT-GAV-DA-SACHET-001', 'Sachet', 'sachet', 10.42, 18.00, 10.000, 'ml', TRUE, FALSE, TRUE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-OREDAR-ORS'), 'OREDA-BOX-50', '8850001000083', 'Box', 'box', 275.00, 450.00, 50.000, 'sachet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-OREDAR-ORS'), 'OREDA-SACHET-1', 'INT-OREDA-ORS-SACHET-001', 'Sachet', 'sachet', 5.50, 10.00, 1.000, 'sachet', TRUE, FALSE, TRUE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-ENO-LEMON'), 'ENO-BOX-48', '8850001000090', 'Box', 'box', 240.00, 384.00, 48.000, 'sachet', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-ENO-LEMON'), 'ENO-SACHET-5G', 'INT-ENO-LEMON-SACHET-001', 'Sachet', 'sachet', 5.00, 10.00, 5.000, 'g', TRUE, FALSE, TRUE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-BLACKMORES-BIOC-1000'), 'BLACKMORES-BIOC-BOTTLE-60', '8850001000106', 'Bottle', 'bottle', 390.00, 590.00, 60.000, 'tablet', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-BLACKMORES-BIOC-1000'), 'BLACKMORES-BIOC-TAB-1', 'INT-BLK-BIOC-TAB-001', 'Tablet', 'tablet', 6.50, 12.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-NATC-1000'), 'NATC-BOTTLE-30', '8850001000113', 'Bottle', 'bottle', 170.00, 260.00, 30.000, 'tablet', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-NATC-1000'), 'NATC-TAB-1', 'INT-NATC-1000-TAB-001', 'Tablet', 'tablet', 5.67, 10.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-BEROCCA-PERF'), 'BEROCCA-TUBE-15', '8850001000120', 'Tube', 'tube', 185.00, 280.00, 15.000, 'tablet', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-BEROCCA-PERF'), 'BEROCCA-TAB-1', 'INT-BEROCCA-TAB-001', 'Effervescent tablet', 'tablet', 12.33, 20.00, 1.000, 'tablet', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-BETADINE-30ML'), 'BETADINE-BOTTLE-30ML', '8850001000137', 'Bottle', 'bottle', 36.00, 55.00, 30.000, 'ml', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-BETADINE-30ML'), 'BETADINE-ML-1', 'INT-BETADINE-ML-001', 'Milliliter', 'ml', 1.20, 2.00, 1.000, 'ml', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-TIGERPLAST-100'), 'TIGERPLAST-BOX-100', '8850001000144', 'Box', 'box', 90.00, 150.00, 100.000, 'piece', FALSE, TRUE, FALSE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-TIGERPLAST-100'), 'TIGERPLAST-PIECE-1', 'INT-TIGERPLAST-PC-001', 'Piece', 'piece', 0.90, 2.00, 1.000, 'piece', TRUE, FALSE, TRUE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-NEXCARE-WP-20'), 'NEXCARE-BOX-20', '8850001000151', 'Box', 'box', 75.00, 120.00, 20.000, 'piece', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-NEXCARE-WP-20'), 'NEXCARE-PIECE-1', 'INT-NEXCARE-WP-PC-001', 'Piece', 'piece', 3.75, 7.00, 1.000, 'piece', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-HIRUDOID-20G'), 'HIRUDOID-TUBE-20G', '8850001000168', 'Tube', 'tube', 125.00, 185.00, 20.000, 'g', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-HIRUDOID-20G'), 'HIRUDOID-GRAM-1', 'INT-HIRUDOID-G-001', 'Gram', 'gram', 6.25, 10.00, 1.000, 'g', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-SMOOTHE-CREAM-15G'), 'SMOOTHE-TUBE-15G', '8850001000175', 'Tube', 'tube', 72.00, 110.00, 15.000, 'g', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-SMOOTHE-CREAM-15G'), 'SMOOTHE-GRAM-1', 'INT-SMOOTHE-G-001', 'Gram', 'gram', 4.80, 8.00, 1.000, 'g', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-NIVEA-SUN-50ML'), 'NIVEA-SUN-TUBE-50ML', '8850001000182', 'Tube', 'tube', 155.00, 249.00, 50.000, 'ml', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-NIVEA-SUN-50ML'), 'NIVEA-SUN-ML-1', 'INT-NIVEA-SUN-ML-001', 'Milliliter', 'ml', 3.10, 5.50, 1.000, 'ml', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-DUREX-FETHERLITE-3'), 'DUREX-BOX-3', '8850001000199', 'Box', 'box', 85.00, 140.00, 3.000, 'piece', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-DUREX-FETHERLITE-3'), 'DUREX-PIECE-1', 'INT-DUREX-FL-PC-001', 'Piece', 'piece', 28.33, 50.00, 1.000, 'piece', TRUE, FALSE, FALSE, 2),

  ((SELECT id FROM products WHERE sku = 'PRD-DENTISTE-PLUSWHITE-100G'), 'DENTISTE-TUBE-100G', '8850001000205', 'Tube', 'tube', 105.00, 165.00, 100.000, 'g', FALSE, TRUE, TRUE, 1),
  ((SELECT id FROM products WHERE sku = 'PRD-DENTISTE-PLUSWHITE-100G'), 'DENTISTE-GRAM-1', 'INT-DENTISTE-G-001', 'Gram', 'gram', 1.05, 2.00, 1.000, 'g', TRUE, FALSE, FALSE, 2);

INSERT INTO product_unit_conversions (
  product_id,
  parent_product_unit_id,
  child_product_unit_id,
  unit_conversion,
  conversion_note
) VALUES
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), (SELECT id FROM product_units WHERE unit_sku = 'SARA-PARA-BOX-100'), (SELECT id FROM product_units WHERE unit_sku = 'SARA-PARA-BLISTER-10'), 10, '1 box = 10 blister packs'),
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), (SELECT id FROM product_units WHERE unit_sku = 'SARA-PARA-BLISTER-10'), (SELECT id FROM product_units WHERE unit_sku = 'SARA-PARA-TAB-1'), 10, '1 blister pack = 10 tablets'),

  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), (SELECT id FROM product_units WHERE unit_sku = 'TYLENOL-BOX-100'), (SELECT id FROM product_units WHERE unit_sku = 'TYLENOL-BLISTER-10'), 10, '1 box = 10 blister packs'),
  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), (SELECT id FROM product_units WHERE unit_sku = 'TYLENOL-BLISTER-10'), (SELECT id FROM product_units WHERE unit_sku = 'TYLENOL-CAPLET-1'), 10, '1 blister pack = 10 caplets'),

  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), (SELECT id FROM product_units WHERE unit_sku = 'TIFFY-DEY-BOX-100'), (SELECT id FROM product_units WHERE unit_sku = 'TIFFY-DEY-BLISTER-4'), 25, '1 box = 25 blister packs'),
  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), (SELECT id FROM product_units WHERE unit_sku = 'TIFFY-DEY-BLISTER-4'), (SELECT id FROM product_units WHERE unit_sku = 'TIFFY-DEY-TAB-1'), 4, '1 blister pack = 4 tablets'),

  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), (SELECT id FROM product_units WHERE unit_sku = 'ZYRTEC-BOX-10'), (SELECT id FROM product_units WHERE unit_sku = 'ZYRTEC-BLISTER-10'), 1, '1 box = 1 blister pack'),
  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), (SELECT id FROM product_units WHERE unit_sku = 'ZYRTEC-BLISTER-10'), (SELECT id FROM product_units WHERE unit_sku = 'ZYRTEC-TAB-1'), 10, '1 blister pack = 10 tablets'),

  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), (SELECT id FROM product_units WHERE unit_sku = 'CLARITYNE-BOX-10'), (SELECT id FROM product_units WHERE unit_sku = 'CLARITYNE-BLISTER-10'), 1, '1 box = 1 blister pack'),
  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), (SELECT id FROM product_units WHERE unit_sku = 'CLARITYNE-BLISTER-10'), (SELECT id FROM product_units WHERE unit_sku = 'CLARITYNE-TAB-1'), 10, '1 blister pack = 10 tablets'),

  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), (SELECT id FROM product_units WHERE unit_sku = 'AIRX-BOX-100'), (SELECT id FROM product_units WHERE unit_sku = 'AIRX-BLISTER-10'), 10, '1 box = 10 blister packs'),
  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), (SELECT id FROM product_units WHERE unit_sku = 'AIRX-BLISTER-10'), (SELECT id FROM product_units WHERE unit_sku = 'AIRX-TAB-1'), 10, '1 blister pack = 10 tablets'),

  ((SELECT id FROM products WHERE sku = 'PRD-GAVISCON-DA-SACHET'), (SELECT id FROM product_units WHERE unit_sku = 'GAVISCON-BOX-24'), (SELECT id FROM product_units WHERE unit_sku = 'GAVISCON-SACHET-10ML'), 24, '1 box = 24 sachets'),
  ((SELECT id FROM products WHERE sku = 'PRD-OREDAR-ORS'), (SELECT id FROM product_units WHERE unit_sku = 'OREDA-BOX-50'), (SELECT id FROM product_units WHERE unit_sku = 'OREDA-SACHET-1'), 50, '1 box = 50 sachets'),
  ((SELECT id FROM products WHERE sku = 'PRD-ENO-LEMON'), (SELECT id FROM product_units WHERE unit_sku = 'ENO-BOX-48'), (SELECT id FROM product_units WHERE unit_sku = 'ENO-SACHET-5G'), 48, '1 box = 48 sachets'),
  ((SELECT id FROM products WHERE sku = 'PRD-BLACKMORES-BIOC-1000'), (SELECT id FROM product_units WHERE unit_sku = 'BLACKMORES-BIOC-BOTTLE-60'), (SELECT id FROM product_units WHERE unit_sku = 'BLACKMORES-BIOC-TAB-1'), 60, '1 bottle = 60 tablets'),
  ((SELECT id FROM products WHERE sku = 'PRD-NATC-1000'), (SELECT id FROM product_units WHERE unit_sku = 'NATC-BOTTLE-30'), (SELECT id FROM product_units WHERE unit_sku = 'NATC-TAB-1'), 30, '1 bottle = 30 tablets'),
  ((SELECT id FROM products WHERE sku = 'PRD-BEROCCA-PERF'), (SELECT id FROM product_units WHERE unit_sku = 'BEROCCA-TUBE-15'), (SELECT id FROM product_units WHERE unit_sku = 'BEROCCA-TAB-1'), 15, '1 tube = 15 effervescent tablets'),
  ((SELECT id FROM products WHERE sku = 'PRD-BETADINE-30ML'), (SELECT id FROM product_units WHERE unit_sku = 'BETADINE-BOTTLE-30ML'), (SELECT id FROM product_units WHERE unit_sku = 'BETADINE-ML-1'), 30, '1 bottle = 30 ml'),
  ((SELECT id FROM products WHERE sku = 'PRD-TIGERPLAST-100'), (SELECT id FROM product_units WHERE unit_sku = 'TIGERPLAST-BOX-100'), (SELECT id FROM product_units WHERE unit_sku = 'TIGERPLAST-PIECE-1'), 100, '1 box = 100 pieces'),
  ((SELECT id FROM products WHERE sku = 'PRD-NEXCARE-WP-20'), (SELECT id FROM product_units WHERE unit_sku = 'NEXCARE-BOX-20'), (SELECT id FROM product_units WHERE unit_sku = 'NEXCARE-PIECE-1'), 20, '1 box = 20 pieces'),
  ((SELECT id FROM products WHERE sku = 'PRD-HIRUDOID-20G'), (SELECT id FROM product_units WHERE unit_sku = 'HIRUDOID-TUBE-20G'), (SELECT id FROM product_units WHERE unit_sku = 'HIRUDOID-GRAM-1'), 20, '1 tube = 20 grams'),
  ((SELECT id FROM products WHERE sku = 'PRD-SMOOTHE-CREAM-15G'), (SELECT id FROM product_units WHERE unit_sku = 'SMOOTHE-TUBE-15G'), (SELECT id FROM product_units WHERE unit_sku = 'SMOOTHE-GRAM-1'), 15, '1 tube = 15 grams'),
  ((SELECT id FROM products WHERE sku = 'PRD-NIVEA-SUN-50ML'), (SELECT id FROM product_units WHERE unit_sku = 'NIVEA-SUN-TUBE-50ML'), (SELECT id FROM product_units WHERE unit_sku = 'NIVEA-SUN-ML-1'), 50, '1 tube = 50 ml'),
  ((SELECT id FROM products WHERE sku = 'PRD-DUREX-FETHERLITE-3'), (SELECT id FROM product_units WHERE unit_sku = 'DUREX-BOX-3'), (SELECT id FROM product_units WHERE unit_sku = 'DUREX-PIECE-1'), 3, '1 box = 3 pieces'),
  ((SELECT id FROM products WHERE sku = 'PRD-DENTISTE-PLUSWHITE-100G'), (SELECT id FROM product_units WHERE unit_sku = 'DENTISTE-TUBE-100G'), (SELECT id FROM product_units WHERE unit_sku = 'DENTISTE-GRAM-1'), 100, '1 tube = 100 grams');

INSERT INTO product_images (product_id, product_unit_id, image_url, alt_text) VALUES
  ((SELECT id FROM products WHERE sku = 'PRD-SARA-PARA-500'), (SELECT id FROM product_units WHERE unit_sku = 'SARA-PARA-BOX-100'), 'https://placehold.co/1024x1024/png?text=Sara+Paracetamol+500mg', 'Sara Paracetamol 500 mg box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-TYLENOL-500'), (SELECT id FROM product_units WHERE unit_sku = 'TYLENOL-BOX-100'), 'https://placehold.co/1024x1024/png?text=Tylenol+500mg', 'Tylenol 500 mg caplet box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-TIFFY-DEY'), (SELECT id FROM product_units WHERE unit_sku = 'TIFFY-DEY-BOX-100'), 'https://placehold.co/1024x1024/png?text=Tiffy+Dey', 'Tiffy Dey cold tablet box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-ZYRTEC-10'), (SELECT id FROM product_units WHERE unit_sku = 'ZYRTEC-BOX-10'), 'https://placehold.co/1024x1024/png?text=Zyrtec+10mg', 'Zyrtec Cetirizine 10 mg box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-CLARITYNE-10'), (SELECT id FROM product_units WHERE unit_sku = 'CLARITYNE-BOX-10'), 'https://placehold.co/1024x1024/png?text=Clarityne+10mg', 'Clarityne Loratadine 10 mg box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-AIRX-CHEW'), (SELECT id FROM product_units WHERE unit_sku = 'AIRX-BOX-100'), 'https://placehold.co/1024x1024/png?text=Air-X+Simethicone', 'Air-X simethicone chewable tablet box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-GAVISCON-DA-SACHET'), (SELECT id FROM product_units WHERE unit_sku = 'GAVISCON-BOX-24'), 'https://placehold.co/1024x1024/png?text=Gaviscon+Double+Action', 'Gaviscon Double Action sachet box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-OREDAR-ORS'), (SELECT id FROM product_units WHERE unit_sku = 'OREDA-BOX-50'), 'https://placehold.co/1024x1024/png?text=Oreda+R.O.+ORS', 'Oreda R.O. ORS box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-ENO-LEMON'), (SELECT id FROM product_units WHERE unit_sku = 'ENO-BOX-48'), 'https://placehold.co/1024x1024/png?text=ENO+Lemon', 'ENO Lemon fruit salt box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-BLACKMORES-BIOC-1000'), (SELECT id FROM product_units WHERE unit_sku = 'BLACKMORES-BIOC-BOTTLE-60'), 'https://placehold.co/1024x1024/png?text=Blackmores+Bio+C+1000', 'Blackmores Bio C 1000 bottle product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-NATC-1000'), (SELECT id FROM product_units WHERE unit_sku = 'NATC-BOTTLE-30'), 'https://placehold.co/1024x1024/png?text=MEGA+Nat+C+1000', 'MEGA We Care Nat C 1000 bottle product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-BEROCCA-PERF'), (SELECT id FROM product_units WHERE unit_sku = 'BEROCCA-TUBE-15'), 'https://placehold.co/1024x1024/png?text=Berocca+Performance', 'Berocca Performance tube product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-BETADINE-30ML'), (SELECT id FROM product_units WHERE unit_sku = 'BETADINE-BOTTLE-30ML'), 'https://placehold.co/1024x1024/png?text=Betadine+30ml', 'Betadine povidone-iodine 30 ml bottle product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-TIGERPLAST-100'), (SELECT id FROM product_units WHERE unit_sku = 'TIGERPLAST-BOX-100'), 'https://placehold.co/1024x1024/png?text=Tigerplast+100', 'Tigerplast adhesive plaster box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-NEXCARE-WP-20'), (SELECT id FROM product_units WHERE unit_sku = 'NEXCARE-BOX-20'), 'https://placehold.co/1024x1024/png?text=Nexcare+Waterproof', '3M Nexcare waterproof plaster box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-HIRUDOID-20G'), (SELECT id FROM product_units WHERE unit_sku = 'HIRUDOID-TUBE-20G'), 'https://placehold.co/1024x1024/png?text=Hirudoid+20g', 'Hirudoid cream 20 g tube product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-SMOOTHE-CREAM-15G'), (SELECT id FROM product_units WHERE unit_sku = 'SMOOTHE-TUBE-15G'), 'https://placehold.co/1024x1024/png?text=Smooth+E+Cream+15g', 'Smooth E Cream 15 g tube product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-NIVEA-SUN-50ML'), (SELECT id FROM product_units WHERE unit_sku = 'NIVEA-SUN-TUBE-50ML'), 'https://placehold.co/1024x1024/png?text=Nivea+Sun+SPF50', 'Nivea Sun Protect and Moisture SPF50 tube product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-DUREX-FETHERLITE-3'), (SELECT id FROM product_units WHERE unit_sku = 'DUREX-BOX-3'), 'https://placehold.co/1024x1024/png?text=Durex+Fetherlite+3', 'Durex Fetherlite condom 3 pieces box product image'),
  ((SELECT id FROM products WHERE sku = 'PRD-DENTISTE-PLUSWHITE-100G'), (SELECT id FROM product_units WHERE unit_sku = 'DENTISTE-TUBE-100G'), 'https://placehold.co/1024x1024/png?text=Dentiste+Plus+White+100g', 'Dentiste Plus White toothpaste 100 g tube product image');

CREATE OR REPLACE VIEW pharmacy_item_seed_view AS
SELECT
  p.item_name,
  p.brand_name,
  m.name AS manufacturer,
  pu.barcode,
  pu.packaging_type,
  parent_pu.unit_name AS parent_unit,
  child_pu.unit_name AS child_unit,
  puc.unit_conversion,
  pu.cost_thb,
  pu.sell_price_thb,
  c.name AS item_category,
  pu.weight,
  pu.weight_unit,
  pi.image_url AS product_image_url,
  puc.conversion_note
FROM products p
JOIN manufacturers m ON m.id = p.manufacturer_id
JOIN categories c ON c.id = p.category_id
JOIN product_units pu ON pu.product_id = p.id AND pu.is_default_purchase_unit = TRUE
LEFT JOIN product_unit_conversions puc ON puc.parent_product_unit_id = pu.id
LEFT JOIN product_units parent_pu ON parent_pu.id = puc.parent_product_unit_id
LEFT JOIN product_units child_pu ON child_pu.id = puc.child_product_unit_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE;

COMMIT;
