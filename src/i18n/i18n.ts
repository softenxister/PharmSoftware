import type { AppLocale } from "@/config/preferences/appPreferences";

import { english, thai, type TranslationKey } from "./catalog/assembleCatalog";

export type { TranslationKey } from "./catalog/assembleCatalog";
export type TranslationParams = Record<string, string | number>;

export function translate(locale: AppLocale, key: TranslationKey, params?: TranslationParams): string {
  const template = locale === "th" ? thai[key] ?? english[key] : english[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

const dateLocale = (locale: AppLocale) => locale === "th" ? "th-TH-u-ca-gregory" : "en-GB";
const numberLocale = (locale: AppLocale) => locale === "th" ? "th-TH" : "en-US";

export function formatDate(
  locale: AppLocale,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    timeZone: "Asia/Bangkok",
    ...options,
  }).format(new Date(value));
}

export function formatNumber(
  locale: AppLocale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(numberLocale(locale), options).format(value);
}

export function formatMoney(locale: AppLocale, value: number): string {
  return formatNumber(locale, value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
