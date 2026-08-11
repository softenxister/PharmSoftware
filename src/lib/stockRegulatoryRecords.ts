export const STOCK_REGULATORY_FORMS = ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"] as const;

export type StockRegulatoryForm = (typeof STOCK_REGULATORY_FORMS)[number];

export const KY11_ANY_FORM_INGREDIENTS = [
  "dextromethorphan",
  "tramadol",
] as const;

export const KY11_LIQUID_ANTIHISTAMINES = [
  "brompheniramine",
  "carbinoxamine",
  "chlorpheniramine",
  "cyproheptadine",
  "dexchlorpheniramine",
  "dimenhydrinate",
  "diphenhydramine",
  "doxylamine",
  "hydroxyzine",
  "promethazine",
  "triprolidine",
] as const;

export const KY11_LIQUID_DOSAGE_TYPES = [
  "syrup",
  "suspension",
  "oral solution",
  "solution",
  "liquid",
  "elixir",
  "drops",
] as const;

type RegulatoryIngredient = {
  canonicalName: string;
  thaiName?: string;
};

type StockRegulatoryInput = {
  legalCategory?: string;
  compositionStatus?: string;
  activeIngredients?: readonly RegulatoryIngredient[];
  dosageType?: string;
};

function normalizeRegulatoryValue(value: string | undefined): string {
  return value?.normalize("NFKC").trim().toLocaleLowerCase("en-US") ?? "";
}

function containsIngredient(
  ingredients: readonly RegulatoryIngredient[],
  names: readonly string[],
): boolean {
  return ingredients.some((ingredient) => {
    const searchableNames = [ingredient.canonicalName, ingredient.thaiName ?? ""]
      .map(normalizeRegulatoryValue);
    return names.some((name) => searchableNames.some((value) => value.includes(name)));
  });
}

export function classifyStockRegulatoryForms({
  legalCategory,
  compositionStatus,
  activeIngredients = [],
  dosageType,
}: StockRegulatoryInput): StockRegulatoryForm[] {
  const forms: StockRegulatoryForm[] = ["ข.ย. 9"];
  const category = normalizeRegulatoryValue(legalCategory);

  if (category === "ยาควบคุมพิเศษ") return [...forms, "ข.ย. 10"];
  if (category !== "ยาอันตราย" || compositionStatus !== "verified") return forms;

  const hasAnyFormIngredient = containsIngredient(activeIngredients, KY11_ANY_FORM_INGREDIENTS);
  const isLiquid = KY11_LIQUID_DOSAGE_TYPES.includes(
    normalizeRegulatoryValue(dosageType) as typeof KY11_LIQUID_DOSAGE_TYPES[number],
  );
  const hasLiquidAntihistamine = isLiquid
    && containsIngredient(activeIngredients, KY11_LIQUID_ANTIHISTAMINES);

  return hasAnyFormIngredient || hasLiquidAntihistamine
    ? [...forms, "ข.ย. 11"]
    : forms;
}
