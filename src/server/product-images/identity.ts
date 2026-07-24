export type ProductImageMatchMethod = "EXACT_GTIN" | "EXACT_REGULATORY_ID" | "TEXT";

export type ProductImageIdentity = {
  gtin?: string | null;
  productName?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  ingredient?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  packCount?: string | null;
  market?: string | null;
  packageLevel?: string | null;
};

export type ProductImageEvidenceResult = {
  decision: "AUTO_PUBLISH" | "REVIEW" | "REJECT";
  autoPublishEligible: boolean;
  score: number;
  agreements: string[];
  missing: string[];
  conflicts: string[];
};

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
const HARD_FIELDS = [
  "brand",
  "manufacturer",
  "ingredient",
  "strength",
  "dosageForm",
  "packCount",
  "market",
  "packageLevel",
] as const;

export function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasValidGtinCheckDigit(digits: string): boolean {
  const payload = digits.slice(0, -1);
  const expected = Number(digits.at(-1));
  let sum = 0;

  for (let index = payload.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(payload[index]) * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === expected;
}

export function normalizeGtin(rawValue: string | null | undefined): string | null {
  const raw = rawValue?.trim() ?? "";
  if (!raw || /[^0-9\s-]/.test(raw)) return null;

  const digits = raw.replace(/[\s-]/g, "");
  if (!GTIN_LENGTHS.has(digits.length) || /^0+$/.test(digits)) return null;
  if (!hasValidGtinCheckDigit(digits)) return null;
  return digits.padStart(14, "0");
}

function normalizeField(field: typeof HARD_FIELDS[number], value: string): string {
  const normalized = normalizeIdentityText(value);
  if (field === "strength") return normalized.replace(/(\d)\s+(mg|mcg|g|kg|ml|l|iu)\b/g, "$1$2");
  if (field === "dosageForm") return normalized.replace(/\b(tablets|tabs)\b/g, "tablet")
    .replace(/\b(capsules|caps)\b/g, "capsule");
  if (field === "packCount") return normalized.replace(/\D/g, "");
  if (field === "market" || field === "packageLevel") return normalized.toUpperCase();
  return normalized;
}

function comparableProductNames(left: string, right: string): boolean {
  const leftNormalized = normalizeIdentityText(left).replace(/(\d)\s+(mg|mcg|g|ml)\b/g, "$1$2");
  const rightNormalized = normalizeIdentityText(right).replace(/(\d)\s+(mg|mcg|g|ml)\b/g, "$1$2");
  if (leftNormalized === rightNormalized) return true;
  if (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized)) return true;

  const leftTokens = new Set(leftNormalized.split(" ").filter(Boolean));
  const rightTokens = new Set(rightNormalized.split(" ").filter(Boolean));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 && shared / union >= 0.5;
}

export function permitsCommercialImageReuse(sourceLicence: string | null | undefined): boolean {
  const value = normalizeIdentityText(sourceLicence ?? "");
  return /^(cc by|cc by sa|cc0|public domain)\b/.test(value)
    || /\b(authorized|licensed manufacturer|licensed distributor)\b/.test(value);
}

export function compareProductImageEvidence(input: {
  product: ProductImageIdentity;
  candidate: ProductImageIdentity;
  sourceLicence: string | null | undefined;
  matchMethod: ProductImageMatchMethod;
}): ProductImageEvidenceResult {
  const agreements: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const productGtin = normalizeGtin(input.product.gtin);
  const candidateGtin = normalizeGtin(input.candidate.gtin);

  if (productGtin && candidateGtin) {
    if (productGtin === candidateGtin) agreements.push("gtin");
    else conflicts.push("gtin");
  } else if (input.matchMethod === "EXACT_GTIN") {
    missing.push("gtin");
  }

  for (const field of HARD_FIELDS) {
    const productValue = input.product[field]?.trim();
    const candidateValue = input.candidate[field]?.trim();
    if (!productValue || !candidateValue) {
      if (productValue || candidateValue) missing.push(field);
      continue;
    }

    if (normalizeField(field, productValue) === normalizeField(field, candidateValue)) {
      agreements.push(field);
    } else {
      conflicts.push(field);
    }
  }

  const productName = input.product.productName?.trim();
  const candidateName = input.candidate.productName?.trim();
  if (productName && candidateName) {
    if (comparableProductNames(productName, candidateName)) agreements.push("productName");
    else conflicts.push("productName");
  } else if (productName || candidateName) {
    missing.push("productName");
  }

  const reusable = permitsCommercialImageReuse(input.sourceLicence);
  if (!reusable) missing.push("sourceLicence");

  const exactIdentifier = input.matchMethod === "EXACT_GTIN"
    && Boolean(productGtin && candidateGtin && productGtin === candidateGtin);
  const autoPublishEligible = exactIdentifier && reusable && conflicts.length === 0;
  const score = Math.max(0, Math.min(100,
    (exactIdentifier ? 70 : 20) + agreements.length * 5 - missing.length * 2 - conflicts.length * 30,
  ));

  return {
    decision: conflicts.length > 0 ? "REJECT" : autoPublishEligible ? "AUTO_PUBLISH" : "REVIEW",
    autoPublishEligible,
    score,
    agreements,
    missing,
    conflicts,
  };
}
