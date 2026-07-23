import {
  findProductCategory,
  NORMALIZED_PRODUCT_CATEGORIES,
} from "@/lib/productCategories";

export { NORMALIZED_PRODUCT_CATEGORIES };

export type ProductCategoryNormalizationInput = {
  itemName: string;
  brandName?: string | null;
  genericName?: string | null;
  sourceCategory?: string | null;
};

export type ProductCategoryClassification = {
  category: string;
  confidence: "high" | "fallback";
  reason: string;
};

type CategoryRule = {
  category: string;
  terms: readonly string[];
  leadingTerms?: readonly string[];
  brands?: readonly string[];
};

function searchable(value: string): string {
  return ` ${value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function containsTerm(text: string, term: string): boolean {
  const normalizedTerm = searchable(term).trim();
  return text.includes(` ${normalizedTerm} `)
    || (/[\u0E00-\u0E7F]/u.test(normalizedTerm) && text.includes(normalizedTerm))
    || (normalizedTerm.length >= 5 && text.includes(normalizedTerm));
}

function startsWithTerm(text: string, term: string): boolean {
  const normalizedTerm = searchable(term).trim();
  return text.startsWith(` ${normalizedTerm} `)
    || (/[\u0E00-\u0E7F]/u.test(normalizedTerm) && text.startsWith(` ${normalizedTerm}`));
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "Women's & Reproductive Health",
    brands: ["durex", "okamoto"],
    terms: [
      "contraceptive", "birth control", "condom", "pregnancy test", "vaginal", "ovule",
      "clotrimazole v t", "candinox 500", "emergency pill", "levonorgestrel",
      "ethinylestradiol", "drospirenone", "ยาคุม", "ถุงยาง", "ตรวจครรภ์", "ช่องคลอด",
      "ยาสตรี", "หลังคลอดบุตร",
    ],
  },
  {
    category: "Oral & Dental Care",
    brands: ["listerine", "sensodyne", "oral-b", "polident", "dr.ray"],
    leadingTerms: ["polident"],
    terms: [
      "toothpaste", "toothbrush", "mouthwash", "mouth wash", "oral rinse", "dental",
      "dentiste", "floss", "mouth spray", "oral paste", "bonjela", "toothache",
      "ยาสีฟัน", "แปรงสีฟัน", "น้ำยาบ้วนปาก", "ไหมขัดฟัน", "ช่องปาก", "ปวดฟัน",
      "แปรงซอกฟัน", "ฟันปลอม",
    ],
  },
  {
    category: "Eye, Ear, Nose & Throat",
    leadingTerms: [
      "voltaren ed", "nexcare opticlude", "3m nexcare opticlude", "cold allergy nasol",
    ],
    terms: [
      "eye drop", "e d", "artificial tear", "lubricant eye", "ophthalmic", "ear drop",
      "otic", "nasal spray", "nasal drop", "contact lens", "saline nose", "ล้างตา",
      "หยอดตา", "น้ำตาเทียม", "หยอดหู", "ล้างจมูก", "พ่นจมูก",
    ],
  },
  {
    category: "Medical Devices & Diagnostics",
    brands: ["omron", "klean", "auramed", "forceps", "gica"],
    leadingTerms: ["nexcare mask", "3m nexcare mask", "3m nexcare หน้ากาก"],
    terms: [
      "thermometer", "blood pressure", "glucometer", "glucose meter", "test strip",
      "lancet", "syringe", "needle", "catheter", "stethoscope", "nebulizer", "spirometer",
      "wheelchair", "walker", "crutch", "medical mask", "face mask", "pm2 5", "n95",
      "kf94", "daily kids mask", "daily mask", "diagnostic test", "covid test",
      "influenza test", "nitrile gloves", "forceps", "eye shield",
      "kleanglove", "glove",
      "เครื่องวัด", "เครื่องตรวจ", "ชุดตรวจ", "เข็มฉีดยา", "สายสวน", "รถเข็น",
      "ไม้เท้า", "หน้ากาก", "ปรอทวัดไข้", "ถุงมือยาง", "ถุงมือไนไตร", "แผ่นตรวจ",
      "ตรวจไข้เลือดออก", "ตรวจท้องร่วง",
    ],
  },
  {
    category: "First Aid & Wound Care",
    brands: [
      "tigerplast", "kleanpad", "sos", "tensoplastic", "fixomull", "neopore", "neotape",
      "alsoff", "rhinotape", "kleantrans", "alcohol",
    ],
    leadingTerms: [
      "neoplast", "neoplastic", "3m neoplast", "3m neoplastic", "nexcare",
      "3m nexcare", "n-zen firstband",
    ],
    terms: [
      "betadine", "povidone iodine", "iodine", "gentian violet", "hydrogen peroxide",
      "rubbing alcohol", "alcohol pad", "normal saline", "wound", "plaster", "bandage",
      "gauze", "micropore", "transpore", "cotton ball", "first aid", "antiseptic",
      "น้ำเกลือ", "ล้างแผล", "แอลกอฮอล์", "ทิงเจอร์", "ไอโอดีน", "ด่างทับทิม",
      "สำลี", "ผ้าก๊อซ", "พลาสเตอร์", "ปฐมพยาบาล", "แผล", "ไฮโดรเจนเปอร์ออกไซด์",
      "เยนเซียน", "ไวโอเล็ต", "พันแผล", "ปิดแผล",
    ],
  },
  {
    category: "Vitamins, Minerals & Supplements",
    brands: [
      "vistra", "blackmores", "proflex", "herbal", "fitne", "ensure", "s-26", "hi-q",
      "caltrate", "centrum", "glucerna", "berocca", "enfalac",
      "scott's", "brand's", "banner", "mamarine",
      "pncp", "amsel", "folic",
    ],
    leadingTerms: ["boost optimum", "boost care", "boost fiber", "royal-d energy"],
    terms: [
      "vitamin", "multivitamin", "ascorbic acid", "b complex", "calcium", "magnesium",
      "zinc", "iron supplement", "fish oil", "cod liver", "omega 3", "collagen",
      "probiotic", "prebiotic", "supplement", "astaxanthin", "coenzyme q10", "q10",
      "lutein", "protein", "whey", "วิตามิน", "แคลเซียม", "แมกนีเซียม", "ซิงค์",
      "nat c", "vit c", "zee 500", "glucose", "น้ำมันปลา", "น้ำมันตับปลา",
      "คอลลาเจน", "อาหารเสริม", "เห็ดหลินจือ",
      "เสริมอาหาร", "ซุปไก่สกัด", "รังนก", "colostrum", "energy gel", "bcaa",
    ],
  },
  {
    category: "Cardiovascular Medicines",
    terms: [
      "amlodipine", "atenolol", "bisoprolol", "metoprolol", "propranolol", "losartan",
      "valsartan", "candesartan", "telmisartan", "enalapril", "lisinopril", "ramipril",
      "quinapril", "accupril", "hydrochlorothiazide", "furosemide", "spironolactone",
      "clopidogrel", "warfarin", "aspirin 81", "aspilets", "asatab", "simvastatin",
      "atorvastatin", "rosuvastatin", "pravastatin", "nifedipine", "diltiazem",
      "verapamil", "isosorbide", "digoxin", "concor", "aggrenox",
    ],
  },
  {
    category: "Diabetes & Endocrine Medicines",
    brands: ["amaryl"],
    terms: [
      "metformin", "glipizide", "gliclazide", "glimepiride", "pioglitazone", "actosmet",
      "sitagliptin", "linagliptin", "dapagliflozin", "empagliflozin", "insulin",
      "levothyroxine", "thyroxine", "carbimazole", "methimazole", "alendronate",
    ],
  },
  {
    category: "Neurology & Mental Health",
    brands: ["exelon"],
    terms: [
      "amitriptyline", "nortriptyline", "fluoxetine", "sertraline", "escitalopram",
      "paroxetine", "venlafaxine", "duloxetine", "diazepam", "lorazepam", "clonazepam",
      "alprazolam", "quetiapine", "olanzapine", "risperidone", "aripiprazole", "abilify",
      "carbamazepine", "valproate", "gabapentin", "pregabalin", "levetiracetam",
      "donepezil", "memantine", "levodopa", "sleep aid", "melatonin", "ยานอนหลับ",
    ],
  },
  {
    category: "Urology & Men's Health",
    terms: [
      "tamsulosin", "alfuzosin", "finasteride", "dutasteride", "oxybutynin", "solifenacin",
      "sildenafil", "tadalafil", "vardenafil", "prostate", "erectile", "ต่อมลูกหมาก",
      "ปัสสาวะ", "สุขภาพบุรุษ",
    ],
  },
  {
    category: "Anti-infective Medicines",
    terms: [
      "amoxicillin", "ampicillin", "penicillin", "cloxacillin", "dicloxacillin",
      "cephalexin", "cefuroxime", "cefixime", "ceftriaxone", "azithromycin",
      "clarithromycin", "erythromycin", "doxycycline", "tetracycline", "ciprofloxacin",
      "levofloxacin", "ofloxacin", "norfloxacin", "metronidazole", "clindamycin",
      "cotrimoxazole", "trimethoprim", "sulfamethoxazole", "acyclovir", "aciclovir",
      "valacyclovir", "oseltamivir", "fluconazole", "itraconazole", "ketoconazole",
      "clotrimazole", "miconazole", "econazole", "terbinafine", "nystatin", "albendazole",
      "mebendazole", "ivermectin", "benzyl benzoate", "ฆ่าเชื้อรา", "ยาฆ่าเชื้อ",
      "ยาถ่ายพยาธิ", "รักษาหิด", "รักษาเหา", "ฟ้าทะลายโจร",
    ],
  },
  {
    category: "Gastrointestinal Medicines",
    brands: ["royal-d"],
    terms: [
      "antacid", "antacil", "aluta", "amogin", "belcid", "brygel", "gaviscon",
      "gaspec", "guttru", "ziga gel", "ziga gas", "simethicone", "air x", "sodamint", "omeprazole",
      "esomeprazole", "pantoprazole", "lansoprazole", "famotidine", "cimetidine",
      "domperidone", "metoclopramide", "ondansetron", "loperamide", "bisacodyl",
      "senna", "senokot", "laxative", "milk of magnesia", "magnesia", "enema",
      "oral rehydration", "electrolyte", "ors", "oreda", "d lyte", "activated charcoal",
      "deltacarbon", "greater ca r bon", "mom vs", "glymorin suppo", "carminative",
      "gripe water", "osra r o", "ยาธาตุ", "เกลือแร่", "แก้ท้อง",
      "ท้องเสีย", "ท้องอืด", "ท้องเฟ้อ", "ยาระบาย", "มะขามแขก", "ขมิ้นชัน",
      "มหาหิงคุ์", "น้ำมันละหุ่ง", "ข่าหอม", "ยาหอม", "ขับลม", "ริดสีดวง",
    ],
  },
  {
    category: "Cold, Cough, Allergy & Respiratory",
    brands: ["throatsil", "ricola", "fisherman's", "bisolvon", "robitussin"],
    leadingTerms: ["mybacin"],
    terms: [
      "cough", "cold tablet", "tiffy", "cetirizine", "zyrtec", "loratadine",
      "desloratadine", "fexofenadine", "chlorpheniramine", "brompheniramine",
      "diphenhydramine", "ambroxol", "bromhexine", "acetylcysteine", "solmax",
      "guaifenesin", "dextromethorphan", "salbutamol", "terbutaline", "theophylline",
      "inhaler", "asmasl", "vicks", "tiffyrub", "eucalyptus", "mybacin throat",
      "cepacol", "strepsils", "ya dom", "ยาแก้ไอ", "แก้ไอ", "ยาอม", "มะขามป้อม",
      "มะแว้ง", "แก้หวัด", "แก้แพ้", "ยาดม", "ยูคาลิปตัส", "แอมโมเนียหอม",
    ],
  },
  {
    category: "Pain & Fever Relief",
    brands: ["buflex", "koolfever"],
    leadingTerms: ["voltaren"],
    terms: [
      "paracetamol", "acetaminophen", "panadol", "tylenol", "sara", "bakamo",
      "cemol", "kamol", "mymol", "paracap", "tempra", "starmol", "cotemp", "ibuprofen",
      "naproxen", "mefenamic", "celecoxib", "etoricoxib", "tramadol", "codeine",
      "aspirin 325", "แก้ปวด", "ลดไข้",
    ],
  },
  {
    category: "Muscle, Bone & Joint Medicines",
    brands: [
      "tubigrip", "futuro", "tynor", "tmsk", "triple-d", "counterpain", "lineup", "dosanac",
      "ls",
    ],
    leadingTerms: [
      "nexcare coldhot", "3m nexcare coldhot", "voltaren emulgel", "n-zen", "futuro",
    ],
    terms: [
      "diclofenac gel", "pain relief gel", "pain patch", "heat patch", "cool gel",
      "analgesic balm", "anasic balm", "tiger balm", "mentholatum", "flanil", "zam buk",
      "relief cream", "muscle", "joint", "arm sling", "ankle support", "knee support",
      "wrist support", "elbow support", "back support", "lumbar support", "clavicle brace",
      "cervical collar", "compression support", "support belt", "cold hot pad", "therapy pack",
      "liniment", "ยาหม่อง", "น้ำมันเหลือง", "ปวดกล้ามเนื้อ", "ปวดข้อ", "ไพล",
      "ปวดเมื่อย", "พยุงหลัง", "พยุงเอว", "พันเคล็ด",
    ],
  },
  {
    category: "Dermatological Medicines",
    brands: ["hirudoid", "hiruscar", "scagel"],
    leadingTerms: [
      "mybacin oint", "nexcare acne", "3m nexcare acne", "cavilon durable barrier",
      "clear nose เซรั่ม รอยสิว", "puricas plus advance",
    ],
    terms: [
      "calamine", "cadramine", "acne", "benzoyl peroxide", "tretinoin", "isotretinoin",
      "acnotin", "hydrocortisone cream", "betamethasone cream", "mometasone",
      "clobetasol", "triamcinolone cream", "scalp lotion", "dermat", "rash", "eczema",
      "aloe gel", "itch", "wart", "corn remover", "วาสลิน", "ผื่น", "คัน", "สิว",
      "calahyst", "kadryl lotion", "ซันก้า", "เพียแคม", "กลาก", "เกลื้อน", "ผิวหนัง",
      "scar gel", "scar care",
    ],
  },
  {
    category: "Personal Care & Cosmetics",
    brands: [
      "eucerin", "smooth e", "vichy", "provamed", "cetaphil", "sebamed",
      "cerave", "bioderma", "physiogel", "sofy", "euc.white", "lactacyd",
      "garnier", "saugella", "loreal", "avene", "d-nee", "kodomo", "mamypoko",
      "huggies", "equilibrium",
      "natur", "skinter", "pan", "sketolene", "veet", "palmer's",
    ],
    leadingTerms: [
      "la roche", "la mer", "preme nobu", "euc ph5", "euc dmt", "euc hya",
      "euc hyaluron", "euc sun", "super stay matte ink",
    ],
    terms: [
      "lipstick", "lip balm", "lip tint", "blush", "mascara", "eyeliner", "foundation",
      "cosmetic", "makeup", "make up", "shampoo", "conditioner", "body wash", "soap",
      "cleanser", "cleansing", "moisturizer", "moisturiser", "sunscreen", "sunblock",
      "deodorant", "sanitary pad", "diaper", "baby wipe", "hand sanitizer", "hand spray",
      "facial moisturising lotion", "facial moisturizing lotion", "body lotion", "baby lotion",
      "facial serum", "eye serum", "hair serum", "hydrating toner", "facial toner",
      "baby bath", "baby wash", "baby oil", "adult diaper", "under pad", "insect repellent",
      "head to toe wash", "sanitizer hand gel", "dettol original bath", "dettol hydrating",
      "เครื่องสำอาง", "ลิป", "บลัช", "แชมพู", "ครีมนวด", "สบู่", "คลีนซิ่ง",
      "กันแดด", "ระงับกลิ่น", "ผ้าอนามัย", "ผ้าอ้อม", "ทิชชู่เปียก", "เจลล้างมือ",
      "เซรั่ม", "โทนเนอร์", "ครีมอาบน้ำ", "เจลอาบน้ำ", "ขวดนม", "จุกนม",
      "ถุงเก็บน้ำนม", "กางเกงซึมซับ", "แผ่นรองซับ", "กันยุง",
    ],
  },
] as const;

const NON_THERAPEUTIC_SOURCE_TERMS = [
  "ยาสามัญประจำบ้าน",
  "ยาอันตราย",
  "ยาควบคุมพิเศษ",
  "ยาใช้ภายนอก",
  "ยาใช้เฉพาะที่",
  "ยาทั่วไป",
  "ยาแผนโบราณ",
  "ยาวัตถุออกฤทธิ์",
  "uncategorized",
];

function isRegulatoryOrUnclassifiedSource(value: string): boolean {
  const normalized = searchable(value);
  return NON_THERAPEUTIC_SOURCE_TERMS.some((term) => normalized.includes(searchable(term).trim()));
}

function categoryEvidence(
  itemText: string,
  genericText: string,
  brandName: string,
  rule: CategoryRule,
): { score: number; reason: string } | null {
  const ingredientTerm = rule.terms.find((value) => containsTerm(genericText, value));
  if (ingredientTerm) {
    return { score: 500, reason: `ingredient:${searchable(ingredientTerm).trim()}` };
  }
  const leadingTerm = rule.leadingTerms?.find((term) => startsWithTerm(itemText, term));
  if (leadingTerm) {
    const normalizedTerm = searchable(leadingTerm).trim();
    return {
      score: 550 + Math.min(normalizedTerm.length, 49),
      reason: `product-family:${normalizedTerm}`,
    };
  }
  const term = rule.terms.find((value) => containsTerm(itemText, value));
  if (term) return { score: 400, reason: `term:${searchable(term).trim()}` };
  const normalizedBrand = searchable(brandName).trim();
  const brand = rule.brands?.find((value) => searchable(value).trim() === normalizedBrand);
  if (brand) return { score: 300, reason: `brand:${searchable(brand).trim()}` };
  return null;
}

export function classifyProductCategory(
  input: ProductCategoryNormalizationInput,
  options: { reevaluateFallback?: boolean } = {},
): ProductCategoryClassification {
  const sourceCategory = input.sourceCategory?.trim() ?? "";
  const knownSource = sourceCategory ? findProductCategory(sourceCategory) : undefined;
  const normalizedSource = searchable(sourceCategory).trim();
  const isExplicitNormalizedCategory = knownSource && [
    knownSource.code,
    knownSource.nameEn,
    knownSource.nameTh,
  ].some((value) => searchable(value).trim() === normalizedSource);
  if (
    knownSource
    && (
      knownSource.code !== "OTHER"
      || (isExplicitNormalizedCategory && !options.reevaluateFallback)
    )
  ) {
    return {
      category: knownSource.nameEn,
      confidence: knownSource.code === "OTHER" ? "fallback" : "high",
      reason: `source:${knownSource.code.toLocaleLowerCase("en-US")}`,
    };
  }

  const itemText = searchable(input.itemName);
  const genericText = searchable(input.genericName ?? "");
  const text = searchable([input.itemName, input.brandName ?? "", input.genericName ?? ""].join(" "));
  const sourceText = searchable(sourceCategory);
  const isHouseholdMedicine = sourceText.includes("ยาสามัญประจำบ้าน");
  const candidates = CATEGORY_RULES.flatMap((rule) => {
    const evidence = categoryEvidence(itemText, genericText, input.brandName ?? "", rule);
    return evidence ? [{ category: rule.category, ...evidence }] : [];
  });
  const topScore = Math.max(0, ...candidates.map((candidate) => candidate.score));
  const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
  const topCategories = [...new Set(topCandidates.map((candidate) => candidate.category))];
  if (topCategories.length === 1) {
    const winner = topCandidates[0];
    return { category: winner.category, confidence: "high", reason: winner.reason };
  }
  if (topCategories.length > 1) {
    return {
      category: "Other Medicines & Health Products",
      confidence: "fallback",
      reason: `conflict:${topCategories.join("|")}`,
    };
  }
  if (isHouseholdMedicine && containsTerm(text, "alcohol")) {
    return {
      category: "First Aid & Wound Care",
      confidence: "high",
      reason: "household-use:alcohol",
    };
  }

  if (sourceText.includes(" dentiste ")) {
    return { category: "Oral & Dental Care", confidence: "high", reason: "source-family:dentiste" };
  }
  if (sourceText.includes(" 2p ")) {
    return { category: "Personal Care & Cosmetics", confidence: "high", reason: "source-family:2p" };
  }
  if (sourceText.includes(" dietary ") || sourceText.includes(" supplement ")) {
    return {
      category: "Vitamins, Minerals & Supplements",
      confidence: "high",
      reason: "source-use:supplement",
    };
  }
  if (sourceText.includes("ยาคุมกำเนิด")) {
    return {
      category: "Women's & Reproductive Health",
      confidence: "high",
      reason: "source-use:contraceptive",
    };
  }
  if (sourceCategory && !isRegulatoryOrUnclassifiedSource(sourceCategory)) {
    const sourceDefinition = findProductCategory(sourceCategory);
    if (sourceDefinition) {
      return {
        category: sourceDefinition.nameEn,
        confidence: sourceDefinition.code === "OTHER" ? "fallback" : "high",
        reason: `source:${sourceDefinition.code.toLocaleLowerCase("en-US")}`,
      };
    }
  }

  return {
    category: "Other Medicines & Health Products",
    confidence: "fallback",
    reason: "fallback:no-evidence",
  };
}

export function normalizeProductCategory(input: ProductCategoryNormalizationInput): string {
  return classifyProductCategory(input).category;
}
