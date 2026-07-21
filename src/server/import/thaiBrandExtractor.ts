import { THAI_PHARMACY_BRAND_RULES } from "./thaiPharmacyBrandAliases";

export type BrandExtractionResult = {
  brandName: string | null;
  confidence: "high" | "medium" | "review";
  matchedAlias: string | null;
  method: "alias" | "leading-token" | "none";
};

const GENERIC_LEADING_TOKENS = new Set([
  "box", "pack", "set", "ชุด", "กล่อง", "แพ็ค", "ซอง",
  "3d", "2d", "kid", "kids", "adult", "face", "mask", "masks",
  "หน้ากาก", "ยา", "ยาสามัญ", "ผง", "ครีม", "เจล", "เม็ด", "แคปซูล",
  "silicone", "stomach", "active", "ingredients", "tab", "tabs", "cap", "caps",
]);

export function normalizeBrandSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("th-TH")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const aliasIndex = THAI_PHARMACY_BRAND_RULES
  .flatMap((rule) => rule.aliases.map((alias) => ({
    brandName: rule.brandName,
    alias,
    normalizedAlias: normalizeBrandSearchText(alias),
  })))
  .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length);

function containsAlias(searchText: string, alias: string): boolean {
  return (` ${searchText} `).includes(` ${alias} `);
}

function stripPackagingPrefix(value: string): string {
  return value
    .replace(/^\s*[\p{P}\p{S}\p{M}]*(?:box|pack|กล่อง|แพ็ค)\s*[\p{P}\p{S}\p{M}]*/iu, "")
    .trim();
}

function leadingFallback(itemName: string): BrandExtractionResult {
  const tokens = stripPackagingPrefix(itemName)
    .normalize("NFKC")
    .split(/\s+/)
    .filter(Boolean);

  for (const rawToken of tokens) {
    const token = rawToken.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, "");
    if (rawToken.includes("%")) break;
    const normalized = normalizeBrandSearchText(token);
    if (!normalized || GENERIC_LEADING_TOKENS.has(normalized)) continue;
    if (/^\d{3}$/.test(normalized)) {
      return { brandName: token, confidence: "medium", matchedAlias: token, method: "leading-token" };
    }
    if (/^\d+(?:\.\d+)?%?$/.test(normalized) || /^\d+(?:ml|mg|g|kg|ชิ้น)$/.test(normalized)) break;
    if (/^(?:no|number) \d+$/.test(normalized) || /^(?:mask|pack|box) \d/.test(normalized)) continue;
    if (!/^[\p{Script=Latin}\p{N}][\p{Script=Latin}\p{N}.'’&-]*$/u.test(token)) break;
    return {
      brandName: token,
      confidence: "medium",
      matchedAlias: token,
      method: "leading-token",
    };
  }

  return { brandName: null, confidence: "review", matchedAlias: null, method: "none" };
}

export function extractThaiPharmacyBrand(itemName: string): BrandExtractionResult {
  const searchText = normalizeBrandSearchText(itemName);
  const match = aliasIndex.find((candidate) => containsAlias(searchText, candidate.normalizedAlias));
  if (match) {
    return {
      brandName: match.brandName,
      confidence: "high",
      matchedAlias: match.alias,
      method: "alias",
    };
  }
  return leadingFallback(itemName);
}

export function resolveImportedBrandName(input: {
  extractedBrandName: string | null;
  existingBrandName?: string | null;
  existingItemName?: string | null;
}): string {
  if (input.extractedBrandName) return input.extractedBrandName;
  if (
    input.existingBrandName
    && input.existingBrandName !== input.existingItemName
    && input.existingBrandName !== "Unspecified"
  ) return input.existingBrandName;
  return "Unspecified";
}
