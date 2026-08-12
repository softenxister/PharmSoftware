export const STOCK_REGULATORY_FORMS = ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"] as const;

export type StockRegulatoryForm = (typeof STOCK_REGULATORY_FORMS)[number];

export const KY11_ANY_FORM_INGREDIENTS = [
  "dextromethorphan",
  "tramadol",
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

export const KY11_SINGLE_INGREDIENTS = [
  "sildenafil",
  "tadalafil",
  "vardenafil",
] as const;

export const KY11_SINGLE_CORTICOSTEROIDS = [
  "alclometasone",
  "amcinonide",
  "beclometasone",
  "beclomethasone",
  "betamethasone",
  "budesonide",
  "ciclesonide",
  "clobetasol",
  "clobetasone",
  "cortisone",
  "deflazacort",
  "desonide",
  "desoximetasone",
  "desoxymethasone",
  "dexamethasone",
  "diflorasone",
  "diflucortolone",
  "fludrocortisone",
  "flumethasone",
  "flunisolide",
  "fluocinolone",
  "fluocinonide",
  "fluocortolone",
  "fluorometholone",
  "fluprednidene",
  "fluticasone",
  "halcinonide",
  "halobetasol",
  "hydrocortisone",
  "loteprednol",
  "medrysone",
  "methylprednisolone",
  "mometasone",
  "paramethasone",
  "prednicarbate",
  "prednisolone",
  "prednisone",
  "rimexolone",
  "tixocortol",
  "triamcinolone",
] as const;

type RegulatoryIngredient = {
  canonicalName: string;
  thaiName?: string;
};

type StockRegulatoryInput = {
  packUnit?: string;
  childUnit?: string;
  legalCategory?: string;
  compositionStatus?: string;
  activeIngredients?: readonly RegulatoryIngredient[];
  importedIngredients?: readonly RegulatoryIngredient[];
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

function isAtomicIngredient(ingredient: RegulatoryIngredient): boolean {
  return !/[+,;/&|]|\s+(?:and|และ)\s+/iu.test(
    `${ingredient.canonicalName} ${ingredient.thaiName ?? ""}`,
  );
}

export function classifyStockRegulatoryForms({
  packUnit,
  childUnit,
  legalCategory,
  compositionStatus,
  activeIngredients = [],
  importedIngredients = [],
}: StockRegulatoryInput): StockRegulatoryForm[] {
  const forms: StockRegulatoryForm[] = ["ข.ย. 9"];
  const category = normalizeRegulatoryValue(legalCategory);

  if (category === "ยาควบคุมพิเศษ") forms.push("ข.ย. 10");

  const hasLiquidUnits = normalizeRegulatoryValue(packUnit) === "bottle"
    && normalizeRegulatoryValue(childUnit) === "ml";
  if (!hasLiquidUnits) return forms;

  const ingredients = compositionStatus === "verified"
    ? activeIngredients
    : importedIngredients;
  if (ingredients.length === 0) return forms;

  const hasAnyFormIngredient = containsIngredient(ingredients, KY11_ANY_FORM_INGREDIENTS);
  const hasSingleFormIngredient = ingredients.length === 1
    && isAtomicIngredient(ingredients[0]) && (
    containsIngredient(ingredients, KY11_SINGLE_INGREDIENTS)
    || containsIngredient(ingredients, KY11_SINGLE_CORTICOSTEROIDS)
  );

  return hasAnyFormIngredient || hasSingleFormIngredient
    ? [...forms, "ข.ย. 11"]
    : forms;
}
