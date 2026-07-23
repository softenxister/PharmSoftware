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

type CategoryRule = {
  category: string;
  terms: readonly string[];
};

function searchable(value: string): string {
  return ` ${value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function containsTerm(text: string, term: string): boolean {
  const normalizedTerm = searchable(term).trim();
  return text.includes(` ${normalizedTerm} `)
    || (normalizedTerm.length >= 5 && text.includes(normalizedTerm));
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "Women's & Reproductive Health",
    terms: [
      "contraceptive", "birth control", "condom", "pregnancy test", "vaginal", "ovule",
      "clotrimazole v t", "candinox 500", "emergency pill", "levonorgestrel",
      "ethinylestradiol", "drospirenone", "ยาคุม", "ถุงยาง", "ตรวจครรภ์", "ช่องคลอด",
    ],
  },
  {
    category: "Oral & Dental Care",
    terms: [
      "toothpaste", "toothbrush", "mouthwash", "mouth wash", "oral rinse", "dental",
      "dentiste", "floss", "mouth spray", "oral paste", "bonjela", "toothache",
      "ยาสีฟัน", "แปรงสีฟัน", "น้ำยาบ้วนปาก", "ไหมขัดฟัน", "ช่องปาก", "ปวดฟัน",
    ],
  },
  {
    category: "Eye, Ear, Nose & Throat",
    terms: [
      "eye drop", "e d", "artificial tear", "lubricant eye", "ophthalmic", "ear drop",
      "otic", "nasal spray", "nasal drop", "contact lens", "saline nose", "ล้างตา",
      "หยอดตา", "น้ำตาเทียม", "หยอดหู", "ล้างจมูก", "พ่นจมูก",
    ],
  },
  {
    category: "Medical Devices & Diagnostics",
    terms: [
      "thermometer", "blood pressure", "glucometer", "glucose meter", "test strip",
      "lancet", "syringe", "needle", "catheter", "stethoscope", "nebulizer", "spirometer",
      "wheelchair", "walker", "crutch", "medical mask", "face mask", "pm2 5", "n95",
      "เครื่องวัด", "เครื่องตรวจ", "ชุดตรวจ", "เข็มฉีดยา", "สายสวน", "รถเข็น",
      "ไม้เท้า", "หน้ากาก", "ปรอทวัดไข้",
    ],
  },
  {
    category: "First Aid & Wound Care",
    terms: [
      "betadine", "povidone iodine", "iodine", "gentian violet", "hydrogen peroxide",
      "rubbing alcohol", "alcohol pad", "normal saline", "wound", "plaster", "bandage",
      "gauze", "micropore", "transpore", "cotton ball", "first aid", "antiseptic",
      "น้ำเกลือ", "ล้างแผล", "แอลกอฮอล์", "ทิงเจอร์", "ไอโอดีน", "ด่างทับทิม",
      "สำลี", "ผ้าก๊อซ", "พลาสเตอร์", "ปฐมพยาบาล", "แผล", "ไฮโดรเจนเปอร์ออกไซด์",
      "เยนเซียน", "ไวโอเล็ต",
    ],
  },
  {
    category: "Vitamins, Minerals & Supplements",
    terms: [
      "vitamin", "multivitamin", "ascorbic acid", "b complex", "calcium", "magnesium",
      "zinc", "iron supplement", "fish oil", "cod liver", "omega 3", "collagen",
      "probiotic", "prebiotic", "supplement", "astaxanthin", "coenzyme q10", "q10",
      "lutein", "protein", "whey", "วิตามิน", "แคลเซียม", "แมกนีเซียม", "ซิงค์",
      "nat c", "vit c", "zee 500", "glucose", "น้ำมันปลา", "น้ำมันตับปลา",
      "คอลลาเจน", "อาหารเสริม", "เห็ดหลินจือ",
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
    terms: [
      "metformin", "glipizide", "gliclazide", "glimepiride", "pioglitazone", "actosmet",
      "sitagliptin", "linagliptin", "dapagliflozin", "empagliflozin", "insulin",
      "levothyroxine", "thyroxine", "carbimazole", "methimazole", "alendronate",
    ],
  },
  {
    category: "Neurology & Mental Health",
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
    terms: [
      "paracetamol", "acetaminophen", "panadol", "tylenol", "sara", "bakamo",
      "cemol", "kamol", "mymol", "paracap", "tempra", "starmol", "cotemp", "ibuprofen",
      "naproxen", "mefenamic", "celecoxib", "etoricoxib", "tramadol", "codeine",
      "aspirin 325", "แก้ปวด", "ลดไข้",
    ],
  },
  {
    category: "Muscle, Bone & Joint Medicines",
    terms: [
      "diclofenac gel", "pain relief gel", "pain patch", "heat patch", "cool gel",
      "analgesic balm", "anasic balm", "tiger balm", "mentholatum", "flanil", "zam buk",
      "relief cream", "muscle", "joint",
      "liniment", "ยาหม่อง", "น้ำมันเหลือง", "ปวดกล้ามเนื้อ", "ปวดข้อ", "ไพล",
    ],
  },
  {
    category: "Dermatological Medicines",
    terms: [
      "calamine", "cadramine", "acne", "benzoyl peroxide", "tretinoin", "isotretinoin",
      "acnotin", "hydrocortisone cream", "betamethasone cream", "mometasone",
      "clobetasol", "triamcinolone cream", "scalp lotion", "dermat", "rash", "eczema",
      "aloe gel", "itch", "wart", "corn remover", "วาสลิน", "ผื่น", "คัน", "สิว",
      "calahyst", "kadryl lotion", "ซันก้า", "เพียแคม", "กลาก", "เกลื้อน", "ผิวหนัง",
    ],
  },
  {
    category: "Personal Care & Cosmetics",
    terms: [
      "lipstick", "lip balm", "lip tint", "blush", "mascara", "eyeliner", "foundation",
      "cosmetic", "makeup", "make up", "shampoo", "conditioner", "body wash", "soap",
      "cleanser", "cleansing", "moisturizer", "moisturiser", "sunscreen", "sunblock",
      "deodorant", "sanitary pad", "diaper", "baby wipe", "hand sanitizer", "hand spray",
      "เครื่องสำอาง", "ลิป", "บลัช", "แชมพู", "ครีมนวด", "สบู่", "คลีนซิ่ง",
      "กันแดด", "ระงับกลิ่น", "ผ้าอนามัย", "ผ้าอ้อม", "ทิชชู่เปียก", "เจลล้างมือ",
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

export function normalizeProductCategory(input: ProductCategoryNormalizationInput): string {
  const sourceCategory = input.sourceCategory?.trim() ?? "";
  const knownSource = sourceCategory ? findProductCategory(sourceCategory) : undefined;
  const normalizedSource = searchable(sourceCategory).trim();
  const isExplicitNormalizedCategory = knownSource && [
    knownSource.code,
    knownSource.nameEn,
    knownSource.nameTh,
  ].some((value) => searchable(value).trim() === normalizedSource);
  if (knownSource && (knownSource.code !== "OTHER" || isExplicitNormalizedCategory)) {
    return knownSource.nameEn;
  }

  const text = searchable([
    input.itemName,
    input.brandName ?? "",
    input.genericName ?? "",
  ].join(" "));
  const sourceText = searchable(sourceCategory);
  const isHouseholdMedicine = sourceText.includes("ยาสามัญประจำบ้าน");
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => containsTerm(text, term))) return rule.category;
  }
  if (isHouseholdMedicine && containsTerm(text, "alcohol")) return "First Aid & Wound Care";

  if (sourceText.includes(" dentiste ")) return "Oral & Dental Care";
  if (sourceText.includes(" 2p ")) return "Personal Care & Cosmetics";
  if (sourceText.includes(" dietary ") || sourceText.includes(" supplement ")) {
    return "Vitamins, Minerals & Supplements";
  }
  if (sourceText.includes("ยาคุมกำเนิด")) return "Women's & Reproductive Health";
  if (sourceCategory && !isRegulatoryOrUnclassifiedSource(sourceCategory)) {
    const sourceDefinition = findProductCategory(sourceCategory);
    if (sourceDefinition) return sourceDefinition.nameEn;
  }

  return "Other Medicines & Health Products";
}
