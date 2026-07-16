import type { AppLocale } from "@/app/settings/appPreferences";

export type StockCategoryOption = {
  value: string;
  label: string;
};

type StockCategoryDefinition = {
  value: string;
  thaiLabel: string;
  aliases?: readonly string[];
};

const STOCK_CATEGORIES: readonly StockCategoryDefinition[] = [
  { value: "Pain Relief", thaiLabel: "ยาแก้ปวด" },
  {
    value: "Allergy & Cold",
    thaiLabel: "หวัด ไอ และภูมิแพ้",
    aliases: ["Cold, Cough & Allergy"],
  },
  { value: "Gastrointestinal", thaiLabel: "ระบบทางเดินอาหาร", aliases: ["Digestive Health"] },
  { value: "Respiratory Care", thaiLabel: "ระบบทางเดินหายใจ" },
  { value: "Antibiotics & Anti-Infectives", thaiLabel: "ยาปฏิชีวนะและต้านเชื้อ" },
  { value: "First Aid", thaiLabel: "ปฐมพยาบาล", aliases: ["Skin, Wound & First Aid"] },
  { value: "Eye, Ear & Nasal Care", thaiLabel: "ตา หู และจมูก" },
  { value: "Oral Care", thaiLabel: "ช่องปากและฟัน", aliases: ["Oral & Dental Care"] },
  { value: "Heart & Circulation", thaiLabel: "หัวใจและหลอดเลือด" },
  { value: "Diabetes Care", thaiLabel: "เบาหวาน" },
  { value: "Sleep & Mental Wellbeing", thaiLabel: "การนอนและสุขภาพจิต" },
  { value: "Women's Health", thaiLabel: "สุขภาพสตรี" },
  { value: "Men's Health", thaiLabel: "สุขภาพบุรุษ" },
  { value: "Sexual & Reproductive Health", thaiLabel: "สุขภาพทางเพศและเจริญพันธุ์" },
  { value: "Mother & Baby Care", thaiLabel: "แม่และเด็ก" },
  {
    value: "Vitamins & Supplements",
    thaiLabel: "วิตามินและอาหารเสริม",
    aliases: ["Vitamins, Minerals & Supplements"],
  },
  { value: "Herbal & Traditional Medicine", thaiLabel: "สมุนไพรและยาแผนไทย" },
  { value: "Medical Devices & Diagnostics", thaiLabel: "อุปกรณ์แพทย์และตรวจวินิจฉัย" },
  { value: "Personal Care", thaiLabel: "ของใช้ส่วนตัว", aliases: ["Personal Care & Hygiene"] },
  { value: "Skincare", thaiLabel: "สกินแคร์และเครื่องสำอาง", aliases: ["Skin Care & Cosmetics"] },
  { value: "Nutrition & Health Foods", thaiLabel: "โภชนาการและอาหารสุขภาพ" },
  { value: "Mobility & Rehabilitation", thaiLabel: "อุปกรณ์ช่วยเดินและฟื้นฟู" },
  { value: "Household Health & Disinfectants", thaiLabel: "สุขภาพในบ้านและฆ่าเชื้อ" },
] as const;

function normalizeCategory(category: string): string {
  return category.trim().toLocaleLowerCase("en-US");
}

const categoryByName = new Map<string, StockCategoryDefinition>();
for (const category of STOCK_CATEGORIES) {
  categoryByName.set(normalizeCategory(category.value), category);
  for (const alias of category.aliases ?? []) {
    categoryByName.set(normalizeCategory(alias), category);
  }
}

export function canonicalizeStockCategory(category: string): string {
  const trimmedCategory = category.trim();
  return categoryByName.get(normalizeCategory(trimmedCategory))?.value ?? trimmedCategory;
}

export function getStockCategoryLabel(locale: AppLocale, category: string): string {
  const trimmedCategory = category.trim();
  const definition = categoryByName.get(normalizeCategory(trimmedCategory));
  if (!definition) return trimmedCategory;
  return locale === "th" ? definition.thaiLabel : definition.value;
}

export function getStockCategoryOptions(locale: AppLocale): StockCategoryOption[] {
  return STOCK_CATEGORIES.map((category) => ({
    value: category.value,
    label: locale === "th" ? category.thaiLabel : category.value,
  }));
}

export function buildStockCategoryOptions(_stockCategories: string[] = []): string[] {
  return STOCK_CATEGORIES.map((category) => category.value);
}

export function filterByStockCategories<T extends { category: string }>(items: T[], categories: string[]): T[] {
  if (categories.length === 0) return items;
  const selectedCategories = new Set(categories.map((category) => normalizeCategory(canonicalizeStockCategory(category))));
  return items.filter((item) => (
    selectedCategories.has(normalizeCategory(canonicalizeStockCategory(item.category)))
  ));
}
