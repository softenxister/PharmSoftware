export const THAI_PHARMACY_CATEGORIES = [
  "Pain Relief",
  "Cold, Cough & Allergy",
  "Digestive Health",
  "Respiratory Care",
  "Antibiotics & Anti-Infectives",
  "Skin, Wound & First Aid",
  "Eye, Ear & Nasal Care",
  "Oral & Dental Care",
  "Heart & Circulation",
  "Diabetes Care",
  "Sleep & Mental Wellbeing",
  "Women's Health",
  "Men's Health",
  "Sexual & Reproductive Health",
  "Mother & Baby Care",
  "Vitamins, Minerals & Supplements",
  "Herbal & Traditional Medicine",
  "Medical Devices & Diagnostics",
  "Personal Care & Hygiene",
  "Skin Care & Cosmetics",
  "Nutrition & Health Foods",
  "Mobility & Rehabilitation",
  "Household Health & Disinfectants",
] as const;

function normalizeCategory(category: string): string {
  return category.trim().toLocaleLowerCase("en-US");
}

export function buildStockCategoryOptions(stockCategories: string[]): string[] {
  const options = [...THAI_PHARMACY_CATEGORIES];
  const seen = new Set(options.map(normalizeCategory));
  const additionalOptions = stockCategories
    .map((category) => category.trim())
    .filter((category) => {
      const key = normalizeCategory(category);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "en-US"));

  return [...options, ...additionalOptions];
}

export function filterByStockCategories<T extends { category: string }>(items: T[], categories: string[]): T[] {
  if (categories.length === 0) return items;
  const selectedCategories = new Set(categories.map(normalizeCategory));
  return items.filter((item) => selectedCategories.has(normalizeCategory(item.category)));
}
