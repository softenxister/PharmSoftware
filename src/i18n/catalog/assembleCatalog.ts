import { sharedEnglish, sharedThai } from "./sharedCatalog";
import { authEnglish, authThai } from "./authCatalog";
import { dashboardEnglish, dashboardThai } from "./dashboardCatalog";
import { memberEnglish, memberThai } from "./memberCatalog";
import { salesEnglish, salesThai } from "./salesCatalog";
import { purchaseEnglish, purchaseThai } from "./purchaseCatalog";
import { stockEnglish, stockThai } from "./stockCatalog";
import { settingsEnglish, settingsThai } from "./settingsCatalog";

export const english = {
  ...sharedEnglish,
  ...authEnglish,
  ...dashboardEnglish,
  ...memberEnglish,
  ...salesEnglish,
  ...purchaseEnglish,
  ...stockEnglish,
  ...settingsEnglish,
} as const;

export type TranslationKey = keyof typeof english;

export const thai: Partial<Record<TranslationKey, string>> = {
  ...sharedThai,
  ...authThai,
  ...dashboardThai,
  ...memberThai,
  ...salesThai,
  ...purchaseThai,
  ...stockThai,
  ...settingsThai,
};

function placeholderNames(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

export function findCatalogPlaceholderMismatches(): string[] {
  return Object.entries(thai).flatMap(([key, localized]) => {
    if (!localized) return [];
    const translationKey = key as TranslationKey;
    const expected = placeholderNames(english[translationKey]);
    const actual = placeholderNames(localized);
    return expected.join("|") === actual.join("|")
      ? []
      : [`${translationKey}: expected {${expected.join(", ")}}, received {${actual.join(", ")}}`];
  });
}
