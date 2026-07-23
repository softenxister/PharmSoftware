import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProductCategory,
  NORMALIZED_PRODUCT_CATEGORIES,
  normalizeProductCategory,
} from "./productCategoryNormalization";

test("normalized categories have separate English and Thai labels and exclude household medicine", () => {
  assert.ok(NORMALIZED_PRODUCT_CATEGORIES.length > 0);
  assert.ok(NORMALIZED_PRODUCT_CATEGORIES.every(({ nameEn, nameTh }) => (
    nameEn.length > 0 && /[\u0E00-\u0E7F]/.test(nameTh)
  )));
  assert.ok(!NORMALIZED_PRODUCT_CATEGORIES.some(({ nameEn, nameTh }) => (
    /household medicine/i.test(nameEn) || nameTh.includes("ยาสามัญประจำบ้าน")
  )));
});

test("household-medicine products map by therapeutic use instead of regulatory label", () => {
  assert.equal(normalizeProductCategory({
    itemName: "BAKAMOL 500MG.10'S.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Pain & Fever Relief");
  assert.equal(normalizeProductCategory({
    itemName: "ANTACIL GEL HH 240ML",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Gastrointestinal Medicines");
  assert.equal(normalizeProductCategory({
    itemName: "BROWN MIXTURE ยาแก้ไอน้ำดำตรางู 120ML.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Cold, Cough, Allergy & Respiratory");
  assert.equal(normalizeProductCategory({
    itemName: "BETADINE 30CC.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "First Aid & Wound Care");
});

test("legal and supplier source groups do not become normalized product categories", () => {
  assert.equal(normalizeProductCategory({
    itemName: "AMOXICILLIN 500MG.10'S.",
    sourceCategory: "ยาอันตราย*#2",
  }), "Anti-infective Medicines");
  assert.equal(normalizeProductCategory({
    itemName: "DENTISTE ยาสีฟัน 100G.",
    sourceCategory: "DENTISTE*",
  }), "Oral & Dental Care");
  assert.equal(normalizeProductCategory({
    itemName: "2P OH MY BLUSH V2-01 ALMOND 5G.",
    sourceCategory: "2P*",
  }), "Personal Care & Cosmetics");
});

test("Neoplast brand-family models map to first aid even without a plaster keyword", () => {
  assert.equal(normalizeProductCategory({
    itemName: "3M NEOPLAST SOFT PAD 5ชิ้น",
    brandName: "3M",
    sourceCategory: "Uncategorized",
  }), "First Aid & Wound Care");
  assert.equal(normalizeProductCategory({
    itemName: "NEOPLAST-S",
    brandName: "3M",
    sourceCategory: "Uncategorized",
  }), "First Aid & Wound Care");
  assert.equal(normalizeProductCategory({
    itemName: "NEOPLAST KOOL PATCH 6ชิ้น",
    brandName: "3M",
    sourceCategory: "Uncategorized",
  }), "First Aid & Wound Care");
  assert.equal(normalizeProductCategory({
    itemName: "NEOPLASTIC TAN พลาสติกสีเนื้อ 20ชิ้น",
    brandName: "NEOPLASTIC",
    sourceCategory: "Uncategorized",
  }), "First Aid & Wound Care");
  assert.equal(normalizeProductCategory({
    itemName: "ANTINEOPLASTIC MEDICINE SAMPLE",
    sourceCategory: "Uncategorized",
  }), "Other Medicines & Health Products");
});

test("unknown products use one broad fallback instead of an invented specific category", () => {
  assert.equal(normalizeProductCategory({
    itemName: "UNKNOWN PHARMACY PRODUCT X1",
    sourceCategory: "Uncategorized",
  }), "Other Medicines & Health Products");
});

test("an explicitly selected normalized fallback category remains stable", () => {
  assert.equal(normalizeProductCategory({
    itemName: "PARACETAMOL SAMPLE",
    sourceCategory: "Other Medicines & Health Products",
  }), "Other Medicines & Health Products");
});

test("bulk classification re-evaluates fallback products and returns auditable evidence", () => {
  assert.deepEqual(classifyProductCategory({
    itemName: "EUCERIN AQUAPORIN GEL CR.50G.",
    brandName: "Eucerin",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }), {
    category: "Personal Care & Cosmetics",
    confidence: "high",
    reason: "brand:eucerin",
  });
});

test("validated retail brands map across broad product categories", () => {
  const cases = [
    ["TUBIGRIP 2-PLY KNEE เข่า (M)", "TUBIGRIP", "Muscle, Bone & Joint Medicines"],
    ["TIGERPLAST (P1) SOFT PAD 60x70มม.5ชิ้น", "TIGERPLAST", "First Aid & Wound Care"],
    ["VISTRA BETA GLUCAN 30'S.", "Vistra", "Vitamins, Minerals & Supplements"],
    ["LISTERINE COOL MINT 250ML.", "Listerine", "Oral & Dental Care"],
    ["DUREX AIRY 52มม.2ชิ้น", "Durex", "Women's & Reproductive Health"],
    ["OMRON HEM-7156-A เครื่องวัดความดัน", "OMRON", "Medical Devices & Diagnostics"],
    ["THROATSIL ชนิดซอง 8เม็ด", "THROATSIL", "Cold, Cough, Allergy & Respiratory"],
  ] as const;

  for (const [itemName, brandName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category);
  }
});

test("the audited second brand set covers common pharmacy shelf families", () => {
  const cases = [
    ["LA ROCHE-POSAY EFFACLAR SERUM 30ML", "LA", "Personal Care & Cosmetics"],
    ["LA MER THE MOISTURIZING CREAM 30ML", "LA", "Personal Care & Cosmetics"],
    ["EUC.WHITE EXTRA BRIGHTENING LOTION", "EUC.WHITE", "Personal Care & Cosmetics"],
    ["LACTACYD FEMININE HYGIENE 150ML", "LACTACYD", "Personal Care & Cosmetics"],
    ["GARNIER MICELLAR CLEANSING WATER", "GARNIER", "Personal Care & Cosmetics"],
    ["SAUGELLA DERMOLIQUIDO 250ML", "SAUGELLA", "Personal Care & Cosmetics"],
    ["LOREAL REVITALIFT SERUM 30ML", "LOREAL", "Personal Care & Cosmetics"],
    ["AVENE THERMAL SPRING WATER 150ML", "AVENE", "Personal Care & Cosmetics"],
    ["D-NEE PURE BABY WASH 380ML", "D-nee", "Personal Care & Cosmetics"],
    ["KODOMO BABY POWDER 200G", "Kodomo", "Personal Care & Cosmetics"],
    ["MAMYPOKO PANTS SIZE M 40PCS", "MamyPoko", "Personal Care & Cosmetics"],
    ["HUGGIES DRY PANTS SIZE L", "HUGGIES", "Personal Care & Cosmetics"],
    ["TENSOPLASTIC ELASTIC PLASTER 10CM", "TENSOPLASTIC", "First Aid & Wound Care"],
    ["FIXOMULL STRETCH 10CM X 2M", "FIXOMULL", "First Aid & Wound Care"],
    ["NEOPORE PAPER TAPE 1 INCH", "NEOPORE", "First Aid & Wound Care"],
    ["NEOTAPE SILK TAPE 1 INCH", "NEOTAPE", "First Aid & Wound Care"],
    ["CALTRATE PLUS 60 TABLETS", "Caltrate", "Vitamins, Minerals & Supplements"],
    ["CENTRUM MULTIVITAMIN 30 TABLETS", "Centrum", "Vitamins, Minerals & Supplements"],
    ["GLUCERNA TRIPLE CARE 400G", "Glucerna", "Vitamins, Minerals & Supplements"],
    ["BEROCCA PERFORMANCE 15 TABLETS", "Berocca", "Vitamins, Minerals & Supplements"],
    ["ENFALAC A+ 1 400G", "ENFALAC", "Vitamins, Minerals & Supplements"],
    ["COUNTERPAIN COOL 60G", "Counterpain", "Muscle, Bone & Joint Medicines"],
    ["HIRUDOID CREAM 20G", "Hirudoid", "Dermatological Medicines"],
    ["HIRUSCAR POST ACNE 10G", "Hiruscar", "Dermatological Medicines"],
    ["SCAGEL SCAR GEL 19G", "Scagel", "Dermatological Medicines"],
    ["BISOLVON ELIXIR 60ML", "Bisolvon", "Cold, Cough, Allergy & Respiratory"],
    ["ROBITUSSIN DM SYRUP 100ML", "Robitussin", "Cold, Cough, Allergy & Respiratory"],
    ["POLIDENT DENTURE CLEANSER 30 TABLETS", "Polident", "Oral & Dental Care"],
    ["EXELON PATCH 10 30PCS", "Exelon", "Neurology & Mental Health"],
  ] as const;

  for (const [itemName, brandName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category, itemName);
  }
});

test("strong product-purpose phrases classify unknown brands without loose substrings", () => {
  assert.equal(classifyProductCategory({
    itemName: "STANDARD ARM SLING SIZE M",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Muscle, Bone & Joint Medicines");
  assert.equal(classifyProductCategory({
    itemName: "STERILE WOUND DRESSING 10X10CM",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "First Aid & Wound Care");
  assert.equal(classifyProductCategory({
    itemName: "DAILY FACIAL MOISTURISING LOTION 50ML",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Personal Care & Cosmetics");
});

test("specific product evidence outranks brand evidence", () => {
  assert.deepEqual(classifyProductCategory({
    itemName: "EUCERIN DIGITAL THERMOMETER",
    brandName: "Eucerin",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }), {
    category: "Medical Devices & Diagnostics",
    confidence: "high",
    reason: "term:thermometer",
  });
  assert.equal(classifyProductCategory({
    itemName: "3M NEXCARE หน้ากากรุ่น KN95",
    brandName: "3M",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Medical Devices & Diagnostics");
});

test("ambiguous brands are not classified without product-level evidence", () => {
  const cases = [
    ["ONETOUCH 003 52MM", "ONETOUCH"],
    ["PREME 21 SAMPLE", "PREME"],
    ["BOOST KOI FISH FOOD 1KG", "BOOST"],
  ] as const;

  for (const [itemName, brandName] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, "Other Medicines & Health Products", itemName);
  }

  assert.equal(classifyProductCategory({
    itemName: "ONETOUCH SELECT PLUS TEST STRIP 25PCS",
    brandName: "ONETOUCH",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Medical Devices & Diagnostics");
});

test("Thai purpose terms match inside unspaced product names", () => {
  const cases = [
    ["ยาดมสมุนไพรหงส์ไทยสูตร 1", "Cold, Cough, Allergy & Respiratory"],
    ["KSG PLAST ผ้าพันแผลมีกาวในตัว", "First Aid & Wound Care"],
    ["G 3D หน้ากากอนามัยสีขาว", "Medical Devices & Diagnostics"],
    ["ผลิตภัณฑ์เสริมอาหารกระชายสกัด", "Vitamins, Minerals & Supplements"],
    ["ยาสตรีเล่งคุณสำหรับหลังคลอดบุตร", "Women's & Reproductive Health"],
    ["หัวเปลี่ยนแปรงซอกฟันทรงต้นสน", "Oral & Dental Care"],
    ["เซรั่มบำรุงผิวหน้าเข้มข้น", "Personal Care & Cosmetics"],
  ] as const;

  for (const [itemName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category, itemName);
  }
});

test("Thai combining marks are preserved and do not create collapsed false positives", () => {
  const cases = [
    "วิกซอล พิ้งค์ น้ำยาล้างห้องน้ำ กลิ่นพิ้งค์พาราไดซ์ 900 มล.",
    "ยาปอคุนเอี๊ยะบ๊อ 500 ซีซี",
  ];

  for (const itemName of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, "Other Medicines & Health Products", itemName);
  }
});

test("audited high-volume families map while mixed sibling lines stay protected", () => {
  const cases = [
    ["SCOTT'S DHA GUMMIES 15'S", "Scott's", "Vitamins, Minerals & Supplements"],
    ["BRAND'S ซุปไก่สกัด 70ML", "BRAND'S", "Vitamins, Minerals & Supplements"],
    ["BANNER GOLD 60 CAPS", "BANNER", "Vitamins, Minerals & Supplements"],
    ["MAMARINE BIO-C 30'S", "MAMARINE", "Vitamins, Minerals & Supplements"],
    ["LINEUP FOR KNEE SPORT L", "LINEUP", "Muscle, Bone & Joint Medicines"],
    ["DOSANAC GEL 25G", "DOSANAC", "Muscle, Bone & Joint Medicines"],
    ["Equilibrium hydrating toner 120ml", "Equilibrium", "Personal Care & Cosmetics"],
    ["Dr.Ray Orthodontic", "Dr.Ray", "Oral & Dental Care"],
    ["Auramed Dengue NS1 1x1test", "Auramed", "Medical Devices & Diagnostics"],
    ["FORCEPS 6นิ้ว", "FORCEPS", "Medical Devices & Diagnostics"],
    ["ALSOFF FOOD GRADE 450ML", "ALSOFF", "First Aid & Wound Care"],
    ["ROYAL-D 25G", "ROYAL-D", "Gastrointestinal Medicines"],
    ["PREME NOBU C WHITE 30G", "PREME", "Personal Care & Cosmetics"],
    ["BOOST OPTIMUM 800G", "BOOST", "Vitamins, Minerals & Supplements"],
    ["3M Nexcare Coldhot Therapy Pack", "3M", "Muscle, Bone & Joint Medicines"],
    ["3M Daily Kids Mask 4'S", "3M", "Medical Devices & Diagnostics"],
  ] as const;

  for (const [itemName, brandName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category, itemName);
  }

  assert.equal(classifyProductCategory({
    itemName: "BOOST KOI สูตรเร่งโต 6.5KG",
    brandName: "BOOST",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Other Medicines & Health Products");
});

test("longer product families disambiguate brands with multiple shelf uses", () => {
  const cases = [
    ["VOLTAREN ED.5ML", "Voltaren", "Eye, Ear, Nose & Throat"],
    ["VOLTAREN EMULGEL 25G", "Voltaren", "Muscle, Bone & Joint Medicines"],
    ["VOLTAREN SR 100MG", "Voltaren", "Pain & Fever Relief"],
    ["N-ZEN FIRSTBAND 2นิ้ว", "N-ZEN", "First Aid & Wound Care"],
    ["N-ZEN GEL 30G", "N-ZEN", "Muscle, Bone & Joint Medicines"],
    ["MYBACIN OINT.15G", "MYBACIN", "Dermatological Medicines"],
    ["MYBACIN OTC รสมิ้นท์", "MYBACIN", "Cold, Cough, Allergy & Respiratory"],
    ["3M NEXCARE OPTICLUDE EYE PATCH", "3M", "Eye, Ear, Nose & Throat"],
    ["3M NEXCARE ACNE PATCH", "3M", "Dermatological Medicines"],
    ["3M NEXCARE SOFT CLOTH 2นิ้ว", "3M", "First Aid & Wound Care"],
    ["Clear Nose เซรั่ม รอยสิว 8g", "Clear", "Dermatological Medicines"],
    ["PURICAS PLUS ADVANCE C&E SCAR GEL เจลรักษาแผลเป็น", "PURICAS", "Dermatological Medicines"],
  ] as const;

  for (const [itemName, brandName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category, itemName);
  }
});

test("additional audited retail brands reduce fallback without broad guesses", () => {
  const cases = [
    ["NATUR ขวดทรงกลม 4OZ", "NATUR", "Personal Care & Cosmetics"],
    ["NATUR H COLOSTRUM 60'S", "NATUR", "Vitamins, Minerals & Supplements"],
    ["SKINTER GUARD DEET 28% 70ML", "SKINTER", "Personal Care & Cosmetics"],
    ["PAN FACIAL DAY CREAM 50G", "PAN", "Personal Care & Cosmetics"],
    ["SKETOLENE SHIELD 70ML", "SKETOLENE", "Personal Care & Cosmetics"],
    ["VEET ELECTRIC TRIMMER", "VEET", "Personal Care & Cosmetics"],
    ["PALMER'S FIRMING LOTION 315ML", "PALMER'S", "Personal Care & Cosmetics"],
    ["PNCP MULTINUTRA 30'S", "PNCP", "Vitamins, Minerals & Supplements"],
    ["AMSEL BILBERRY 15'S", "Amsel", "Vitamins, Minerals & Supplements"],
    ["FOLIC ACID 90'S", "FOLIC", "Vitamins, Minerals & Supplements"],
    ["AMARYL 2MG 15'S", "AMARYL", "Diabetes & Endocrine Medicines"],
    ["BUFLEX 400MG 10'S", "BUFLEX", "Pain & Fever Relief"],
    ["KOOLFEVER FOR CHILDREN", "KOOLFEVER", "Pain & Fever Relief"],
    ["LS SUPPORT-CW XL", "LS", "Muscle, Bone & Joint Medicines"],
    ["RHINOTAPE POROUS SPORT TAPE", "Rhinotape", "First Aid & Wound Care"],
    ["KLEANTRANS 1 INCH X 5 YARD", "KLEANTRANS", "First Aid & Wound Care"],
    ["ALCOHOL LPSOFF 450ML", "ALCOHOL", "First Aid & Wound Care"],
    ["GICA A/B+C+RSV TEST", "GICA", "Medical Devices & Diagnostics"],
  ] as const;

  for (const [itemName, brandName, category] of cases) {
    assert.equal(classifyProductCategory({
      itemName,
      brandName,
      sourceCategory: "Other Medicines & Health Products",
    }, { reevaluateFallback: true }).category, category, itemName);
  }

  assert.equal(classifyProductCategory({
    itemName: "DETTOL MULTI SURFACE CLEANER 405ML",
    brandName: "Dettol",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Other Medicines & Health Products");
  assert.equal(classifyProductCategory({
    itemName: "DETTOL ORIGINAL BATH 450G",
    brandName: "Dettol",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Personal Care & Cosmetics");
  assert.equal(classifyProductCategory({
    itemName: "ROYAL-D ENERGY GEL 40G",
    brandName: "ROYAL-D",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Vitamins, Minerals & Supplements");
  assert.equal(classifyProductCategory({
    itemName: "ROYAL-D ENERGY BCAA1400 MG",
    brandName: "ROYAL-D",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Vitamins, Minerals & Supplements");
  assert.equal(classifyProductCategory({
    itemName: "COLD & ALLERGY NASOL SPRAY 20ML",
    brandName: "COLD",
    genericName: "Zinc",
    sourceCategory: "Other Medicines & Health Products",
  }, { reevaluateFallback: true }).category, "Eye, Ear, Nose & Throat");
});
