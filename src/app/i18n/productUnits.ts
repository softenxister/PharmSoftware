import type { AppLocale } from "@/app/settings/appPreferences";

type UnitDefinition = {
  value: string;
  en: string;
  enPlural?: string;
  th: string;
  aliases?: readonly string[];
};

const UNIT_DEFINITIONS: readonly UnitDefinition[] = [
  { value: "tablet", en: "tablet", enPlural: "tablets", th: "เม็ด", aliases: ["tab", "tabs", "tablets", "เม็ด", "caplet", "caplets", "เม็ดรี"] },
  { value: "capsule", en: "capsule", enPlural: "capsules", th: "แคปซูล", aliases: ["capsules", "cap", "caps", "แคปซูล"] },
  {
    value: "blisterpack",
    en: "blister pack",
    enPlural: "blister packs",
    th: "แผง",
    aliases: ["blister", "blister pack", "blister packs", "strip", "strips", "แผง", "แถบ"],
  },
  { value: "box", en: "box", enPlural: "boxes", th: "กล่อง", aliases: ["boxes", "กล่อง", "กล่องใหญ่"] },
  {
    value: "bottle",
    en: "bottle",
    enPlural: "bottles",
    th: "ขวด",
    aliases: [
      "bottles", "ขวด", "vial", "vials", "ขวดไวอัล", "ampoule", "ampoules", "ampule", "ampules",
      "แอมพูล", "drop", "drops", "หยด", "spray", "sprays", "สเปรย์",
    ],
  },
  { value: "sachet", en: "sachet", enPlural: "sachets", th: "ซอง", aliases: ["sachets", "ซอง"] },
  { value: "tube", en: "tube", enPlural: "tubes", th: "หลอด", aliases: ["tubes", "หลอด", "ท่อ"] },
  {
    value: "piece",
    en: "piece",
    enPlural: "pieces",
    th: "ชิ้น",
    aliases: [
      "pieces", "ชิ้น", "อัน", "ใบ", "ตัว", "ลูก", "เส้น", "คัน", "ผืน", "ดวง", "หน่วย",
      "pen", "pens", "pen.", "ปากกา", "syringe", "syringes", "กระบอกฉีดยา", "dose", "doses",
      "โดส", "puff", "puffs", "ครั้ง", "suppository", "suppositories", "ยาเหน็บ",
    ],
  },
  {
    value: "pack",
    en: "pack",
    enPlural: "packs",
    th: "แพ็ค",
    aliases: ["packs", "แพ็ค", "ห่อ", "โหล", "แพ็คคู่", "แพ็คx2", "แพ็คx3", "แพ็คx6", "แพ็คx12", "แพ็คx36"],
  },
  { value: "carton", en: "carton", enPlural: "cartons", th: "ลัง", aliases: ["cartons", "ลัง"] },
  { value: "bag", en: "bag", enPlural: "bags", th: "ถุง", aliases: ["bags", "ถุง"] },
  { value: "roll", en: "roll", enPlural: "rolls", th: "ม้วน", aliases: ["rolls", "ม้วน"] },
  { value: "set", en: "set", enPlural: "sets", th: "ชุด", aliases: ["sets", "ชุด"] },
  { value: "pair", en: "pair", enPlural: "pairs", th: "คู่", aliases: ["pairs", "คู่"] },
  { value: "sheet", en: "sheet", enPlural: "sheets", th: "แผ่น", aliases: ["sheets", "แผ่น", "patch", "patches", "แผ่นแปะ"] },
  { value: "stick", en: "stick", enPlural: "sticks", th: "แท่ง", aliases: ["sticks", "แท่ง"] },
  { value: "bar", en: "bar", enPlural: "bars", th: "ก้อน", aliases: ["bars", "ก้อน"] },
  { value: "jar", en: "jar", enPlural: "jars", th: "กระปุก", aliases: ["jars", "กระปุก", "container", "containers", "ภาชนะ", "กป."] },
  { value: "can", en: "can", enPlural: "cans", th: "กระป๋อง", aliases: ["cans", "กระป๋อง"] },
  { value: "case", en: "case", enPlural: "cases", th: "ตลับ", aliases: ["cases", "ตลับ"] },
  { value: "device", en: "device", enPlural: "devices", th: "เครื่อง", aliases: ["devices", "เครื่อง"] },
  { value: "basket", en: "basket", enPlural: "baskets", th: "กระเช้า", aliases: ["baskets", "กระเช้า"] },
  { value: "sack", en: "sack", enPlural: "sacks", th: "กระสอบ", aliases: ["sacks", "กระสอบ"] },
  { value: "cabinet", en: "cabinet", enPlural: "cabinets", th: "ตู้", aliases: ["cabinets", "ตู้"] },
  { value: "gallon", en: "gallon", enPlural: "gallons", th: "แกลลอน", aliases: ["gallons", "แกลลอน"] },
  { value: "kg", en: "kg", th: "กก.", aliases: ["kilogram", "kilograms", "กก."] },
  { value: "g", en: "g", th: "กรัม", aliases: ["gram", "grams", "กรัม"] },
  { value: "l", en: "L", th: "ลิตร", aliases: ["liter", "liters", "litre", "litres", "ลิตร"] },
  { value: "ml", en: "ml", th: "มล.", aliases: ["milliliter", "milliliters", "millilitre", "millilitres", "มล.", "cc", "ซีซี"] },
  { value: "cartridge", en: "cartridge", enPlural: "cartridges", th: "ตลับยา", aliases: ["cartridges", "ตลับยา"] },
  { value: "syrup", en: "syrup", th: "ยาน้ำเชื่อม", aliases: ["ยาน้ำเชื่อม"] },
  { value: "suspension", en: "suspension", th: "ยาน้ำแขวนตะกอน", aliases: ["ยาน้ำแขวนตะกอน"] },
  { value: "oral solution", en: "oral solution", th: "ยาน้ำรับประทาน", aliases: ["ยาน้ำรับประทาน"] },
  { value: "cream", en: "cream", th: "ครีม", aliases: ["ครีม"] },
  { value: "ointment", en: "ointment", th: "ขี้ผึ้ง", aliases: ["ขี้ผึ้ง"] },
  { value: "gel", en: "gel", th: "เจล", aliases: ["เจล"] },
  { value: "lotion", en: "lotion", th: "โลชั่น", aliases: ["โลชั่น"] },
  { value: "powder", en: "powder", th: "ผง", aliases: ["ผง"] },
  { value: "inhaler", en: "inhaler", enPlural: "inhalers", th: "ยาสูด", aliases: ["inhalers", "ยาสูด"] },
  { value: "injection", en: "injection", enPlural: "injections", th: "ยาฉีด", aliases: ["injections", "ยาฉีด"] },
];

export const PRODUCT_UNIT_VALUES = Object.freeze([
  "tablet", "capsule", "blisterpack", "box", "bottle", "sachet", "tube", "piece",
  "pack", "carton", "bag", "roll", "set", "pair", "sheet", "stick", "bar", "jar", "can",
  "case", "device", "basket", "sack", "cabinet", "gallon", "cartridge",
] as const);

export const PRODUCT_PACKAGE_VALUES = Object.freeze([
  ...PRODUCT_UNIT_VALUES,
] as const);

export const PRODUCT_SUBUNIT_VALUES = Object.freeze([
  ...PRODUCT_UNIT_VALUES,
  "kg", "g", "l", "ml",
] as const);

const THAI_PATTERN = /[\u0E00-\u0E7F]/;
const ENGLISH_PATTERN = /[A-Za-z]/;
const BLOCKED_UNIT_ALIASES = new Set(["mg", "mcg", "มก", "มก.", "มคก", "มคก."]);
const DEPRECATED_UNIT_ALIASES = new Set([
  "caplet", "caplets", "เม็ดรี", "container", "containers", "ภาชนะ", "vial", "vials", "ขวดไวอัล",
  "pen", "pens", "pen.", "ปากกา", "ampoule", "ampoules", "ampule", "ampules", "แอมพูล",
  "syringe", "syringes", "กระบอกฉีดยา", "strip", "strips", "แถบ", "drop", "drops", "หยด",
  "dose", "doses", "โดส", "puff", "puffs", "ครั้ง", "spray", "sprays", "สเปรย์",
  "patch", "patches", "แผ่นแปะ", "suppository", "suppositories", "ยาเหน็บ",
  "mg", "mcg", "มก", "มก.", "มคก", "มคก.", "cc", "ซีซี",
]);

function normalizeUnitKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

const UNIT_BY_ALIAS = new Map<string, UnitDefinition>();
for (const definition of UNIT_DEFINITIONS) {
  for (const alias of [definition.value, definition.en, definition.enPlural, definition.th, ...(definition.aliases ?? [])]) {
    if (alias) UNIT_BY_ALIAS.set(normalizeUnitKey(alias), definition);
  }
}

export function canonicalizeProductUnit(value: string): string {
  const normalized = normalizeUnitKey(value);
  if (BLOCKED_UNIT_ALIASES.has(normalized)) return "piece";
  return UNIT_BY_ALIAS.get(normalized)?.value ?? value.trim();
}

export function replaceDeprecatedProductUnit(value: string): string {
  const normalized = normalizeUnitKey(value);
  return DEPRECATED_UNIT_ALIASES.has(normalized) ? canonicalizeProductUnit(value) : value.trim();
}

function hasPluralQuantity(quantity: number | string | undefined): boolean {
  if (quantity === undefined) return false;
  const parsed = typeof quantity === "number" ? quantity : Number(quantity.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed !== 1;
}

export function localizeProductUnit(
  locale: AppLocale,
  value: string,
  quantity?: number | string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return locale === "th" ? "หน่วย" : "unit";
  if (BLOCKED_UNIT_ALIASES.has(normalizeUnitKey(trimmed))) return locale === "th" ? "หน่วย" : "unit";
  const definition = UNIT_BY_ALIAS.get(normalizeUnitKey(trimmed));
  if (definition) {
    if (locale === "th") return definition.th;
    return hasPluralQuantity(quantity) ? definition.enPlural ?? definition.en : definition.en;
  }
  if (locale === "th") return THAI_PATTERN.test(trimmed) && !ENGLISH_PATTERN.test(trimmed) ? trimmed : "หน่วย";
  return THAI_PATTERN.test(trimmed) ? "unit" : trimmed;
}

const NUMBER_SOURCE = "[+-]?\\d+(?:[.,]\\d+)?";
const RELATION_PATTERN = new RegExp(`^(${NUMBER_SOURCE})\\s+(.+?)\\s*=\\s*(${NUMBER_SOURCE})\\s+(.+)$`);
const SLASH_PATTERN = new RegExp(`^(${NUMBER_SOURCE})\\s*\\/\\s*(.+)$`);
const QUANTITY_PATTERN = new RegExp(`^(${NUMBER_SOURCE})\\s+(.+)$`);
const BRACKET_PATTERN = /^(.+?)\s*\[([^\]]+)]$/;
const PARENTHETICAL_PATTERN = /^(.+?)\s*\(([^)]+)\)$/;

export function localizeUnitExpression(locale: AppLocale, value: string): string {
  const trimmed = value.trim();
  const relation = trimmed.match(RELATION_PATTERN);
  if (relation) {
    return `${relation[1]} ${localizeProductUnit(locale, relation[2], relation[1])} = ${relation[3]} ${localizeProductUnit(locale, relation[4], relation[3])}`;
  }
  const bracket = trimmed.match(BRACKET_PATTERN);
  if (bracket) return `${localizeProductUnit(locale, bracket[1])}[${bracket[2]}]`;
  const parenthetical = trimmed.match(PARENTHETICAL_PATTERN);
  if (parenthetical) return `${localizeProductUnit(locale, parenthetical[1])}(${parenthetical[2]})`;
  const slash = trimmed.match(SLASH_PATTERN);
  if (slash) return `${slash[1]} / ${localizeProductUnit(locale, slash[2], slash[1])}`;
  const quantity = trimmed.match(QUANTITY_PATTERN);
  if (quantity) return `${quantity[1]} ${localizeProductUnit(locale, quantity[2], quantity[1])}`;
  return localizeProductUnit(locale, trimmed);
}

export function formatProductPackLabel(
  locale: AppLocale,
  quantity: number | string,
  unit: string,
): string {
  return `${quantity} ${localizeProductUnit(locale, unit, quantity)}`;
}

export function formatProductPackRelation(
  locale: AppLocale,
  packUnit: string,
  childQuantity: number | string,
  childUnit: string,
): string {
  return `1 ${localizeProductUnit(locale, packUnit, 1)} = ${childQuantity} ${localizeProductUnit(locale, childUnit, childQuantity)}`;
}
