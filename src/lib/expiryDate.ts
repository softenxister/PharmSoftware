const BUDDHIST_YEAR_OFFSET = 543;
const BUDDHIST_SHORT_YEAR_MINIMUM = 69;
const BUDDHIST_SHORT_YEAR_CENTURY = 2500;

type ExpiryDateParts = {
  year: number;
  month: number;
  day: number;
};

const toChristianYear = (year: number) => (
  year >= 2400 ? year - BUDDHIST_YEAR_OFFSET : year
);

const toChristianYearFromTwoDigits = (year: number) => (
  year >= BUDDHIST_SHORT_YEAR_MINIMUM
    ? BUDDHIST_SHORT_YEAR_CENTURY + year - BUDDHIST_YEAR_OFFSET
    : 2000 + year
);

function validParts(year: number, month: number, day: number): ExpiryDateParts | null {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function parseExpiryDate(value: string | null | undefined): ExpiryDateParts | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (iso) {
    return validParts(
      toChristianYear(Number(iso[1])),
      Number(iso[2]),
      Number(iso[3]),
    );
  }

  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(normalized);
  if (!dayFirst) return null;
  const rawYear = Number(dayFirst[3]);
  const year = dayFirst[3].length === 2
    ? toChristianYearFromTwoDigits(rawYear)
    : toChristianYear(rawYear);
  return validParts(year, Number(dayFirst[2]), Number(dayFirst[1]));
}

export function normalizeExpiryDate(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";
  const parsed = parseExpiryDate(normalized);
  if (!parsed) throw new Error(`Expiry date '${normalized}' is invalid.`);
  return [
    String(parsed.year).padStart(4, "0"),
    String(parsed.month).padStart(2, "0"),
    String(parsed.day).padStart(2, "0"),
  ].join("-");
}

export function isIsoExpiryDate(
  value: unknown,
  options: { allowEmpty?: boolean } = {},
): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return options.allowEmpty === true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  try {
    return normalizeExpiryDate(normalized) === normalized;
  } catch {
    return false;
  }
}

export function formatPurchaseExpiryDate(value: string | null | undefined): string {
  const parsed = parseExpiryDate(value);
  if (!parsed) return "";
  return [
    String(parsed.day).padStart(2, "0"),
    String(parsed.month).padStart(2, "0"),
    String(parsed.year % 100).padStart(2, "0"),
  ].join("-");
}

export function formatPurchaseExpiryInput(value: string): string {
  const normalized = value.trim();
  const shortYearDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/.exec(normalized);
  if (shortYearDate) {
    return [
      shortYearDate[1].padStart(2, "0"),
      shortYearDate[2].padStart(2, "0"),
      shortYearDate[3],
    ].join("-");
  }
  const completeDigits = /^\d{8}$/.test(normalized)
    ? `${normalized.slice(0, 2)}/${normalized.slice(2, 4)}/${normalized.slice(4)}`
    : normalized;
  const complete = parseExpiryDate(completeDigits);
  if (complete) return formatPurchaseExpiryDate(completeDigits);

  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function isPurchaseExpiryDate(value: string): boolean {
  return /^\d{2}-\d{2}-\d{2}$/.test(value.trim()) && parseExpiryDate(value) !== null;
}

export function displayIsoExpiryDate(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "-";
  try {
    return normalizeExpiryDate(normalized);
  } catch {
    return normalized;
  }
}
