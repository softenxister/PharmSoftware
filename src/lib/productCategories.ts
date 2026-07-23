export type ProductCategoryDefinition = {
  code: string;
  nameEn: string;
  nameTh: string;
  aliases?: readonly string[];
};

export const NORMALIZED_PRODUCT_CATEGORIES: readonly ProductCategoryDefinition[] = [
  { code: "PAIN", nameEn: "Pain & Fever Relief", nameTh: "ยาแก้ปวดและลดไข้", aliases: ["Pain Relief"] },
  {
    code: "RESP",
    nameEn: "Cold, Cough, Allergy & Respiratory",
    nameTh: "ยาแก้หวัด ไอ ภูมิแพ้ และระบบทางเดินหายใจ",
    aliases: ["Allergy & Cold", "Cold, Cough & Allergy", "Respiratory Care"],
  },
  {
    code: "GI",
    nameEn: "Gastrointestinal Medicines",
    nameTh: "ยาระบบทางเดินอาหาร",
    aliases: ["Gastrointestinal", "Digestive Health"],
  },
  {
    code: "INFECT",
    nameEn: "Anti-infective Medicines",
    nameTh: "ยาต้านการติดเชื้อ",
    aliases: ["Antibiotics & Anti-Infectives"],
  },
  {
    code: "CARDIO",
    nameEn: "Cardiovascular Medicines",
    nameTh: "ยาระบบหัวใจและหลอดเลือด",
    aliases: ["Heart & Circulation"],
  },
  {
    code: "ENDO",
    nameEn: "Diabetes & Endocrine Medicines",
    nameTh: "ยาเบาหวานและระบบต่อมไร้ท่อ",
    aliases: ["Diabetes Care"],
  },
  {
    code: "NEURO",
    nameEn: "Neurology & Mental Health",
    nameTh: "ยาระบบประสาทและสุขภาพจิต",
    aliases: ["Sleep & Mental Wellbeing"],
  },
  { code: "MSK", nameEn: "Muscle, Bone & Joint Medicines", nameTh: "ยากล้ามเนื้อ กระดูก และข้อ" },
  { code: "SKIN", nameEn: "Dermatological Medicines", nameTh: "ยารักษาโรคผิวหนัง" },
  {
    code: "ENT",
    nameEn: "Eye, Ear, Nose & Throat",
    nameTh: "ยาตา หู คอ และจมูก",
    aliases: ["Eye, Ear & Nasal Care"],
  },
  {
    code: "ORAL",
    nameEn: "Oral & Dental Care",
    nameTh: "ยาสำหรับช่องปากและทันตกรรม",
    aliases: ["Oral Care"],
  },
  {
    code: "WOMEN",
    nameEn: "Women's & Reproductive Health",
    nameTh: "สุขภาพสตรี การคุมกำเนิด และอนามัยเจริญพันธุ์",
    aliases: ["Women's Health", "Sexual & Reproductive Health"],
  },
  { code: "URO", nameEn: "Urology & Men's Health", nameTh: "ยาระบบทางเดินปัสสาวะและสุขภาพบุรุษ", aliases: ["Men's Health"] },
  {
    code: "VIT",
    nameEn: "Vitamins, Minerals & Supplements",
    nameTh: "วิตามิน แร่ธาตุ และอาหารเสริม",
    aliases: ["Vitamins & Supplements"],
  },
  {
    code: "FIRST_AID",
    nameEn: "First Aid & Wound Care",
    nameTh: "ผลิตภัณฑ์ปฐมพยาบาลและดูแลบาดแผล",
    aliases: ["First Aid", "Skin, Wound & First Aid"],
  },
  {
    code: "DEVICE",
    nameEn: "Medical Devices & Diagnostics",
    nameTh: "อุปกรณ์การแพทย์และการตรวจวินิจฉัย",
    aliases: ["Mobility & Rehabilitation"],
  },
  {
    code: "PERSONAL",
    nameEn: "Personal Care & Cosmetics",
    nameTh: "ของใช้ส่วนบุคคลและเครื่องสำอาง",
    aliases: ["Personal Care", "Personal Care & Hygiene", "Skincare", "Skin Care & Cosmetics", "Mother & Baby Care"],
  },
  {
    code: "OTHER",
    nameEn: "Other Medicines & Health Products",
    nameTh: "ยาและผลิตภัณฑ์สุขภาพอื่น ๆ",
    aliases: ["Uncategorized", "Nutrition & Health Foods", "Household Health & Disinfectants"],
  },
] as const;

function normalizeCategoryName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

const categoryByName = new Map<string, ProductCategoryDefinition>();
for (const category of NORMALIZED_PRODUCT_CATEGORIES) {
  categoryByName.set(normalizeCategoryName(category.nameEn), category);
  categoryByName.set(normalizeCategoryName(category.nameTh), category);
  categoryByName.set(normalizeCategoryName(category.code), category);
  for (const alias of category.aliases ?? []) {
    categoryByName.set(normalizeCategoryName(alias), category);
  }
}

export function findProductCategory(value: string): ProductCategoryDefinition | undefined {
  return categoryByName.get(normalizeCategoryName(value));
}

export function canonicalizeProductCategory(value: string): string {
  const trimmed = value.trim();
  return findProductCategory(trimmed)?.nameEn ?? trimmed;
}

export function localizeProductCategory(locale: "en" | "th", value: string): string {
  const category = findProductCategory(value);
  if (!category) return value.trim();
  return locale === "th" ? category.nameTh : category.nameEn;
}
