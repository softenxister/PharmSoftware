import type { AppLocale } from "@/config/preferences/appPreferences";
import {
  canonicalizeProductCategory,
  localizeProductCategory,
  NORMALIZED_PRODUCT_CATEGORIES,
} from "@/lib/productCategories";

export type StockCategoryOption = {
  value: string;
  label: string;
};

function normalizeCategory(category: string): string {
  return category.trim().toLocaleLowerCase("en-US");
}

export function canonicalizeStockCategory(category: string): string {
  return canonicalizeProductCategory(category);
}

export function getStockCategoryLabel(locale: AppLocale, category: string): string {
  return localizeProductCategory(locale, category);
}

export function getStockCategoryOptions(locale: AppLocale): StockCategoryOption[] {
  return NORMALIZED_PRODUCT_CATEGORIES.map((category) => ({
    value: category.nameEn,
    label: locale === "th" ? category.nameTh : category.nameEn,
  }));
}

export function buildStockCategoryOptions(_stockCategories: string[] = []): string[] {
  return NORMALIZED_PRODUCT_CATEGORIES.map((category) => category.nameEn);
}

export function filterByStockCategories<T extends { category: string }>(items: T[], categories: string[]): T[] {
  if (categories.length === 0) return items;
  const selectedCategories = new Set(categories.map((category) => normalizeCategory(canonicalizeStockCategory(category))));
  return items.filter((item) => (
    selectedCategories.has(normalizeCategory(canonicalizeStockCategory(item.category)))
  ));
}
