const THAI_FIXED_LINE_PATTERN = /^02\d{7}$/;
const THAI_TEN_DIGIT_PATTERN = /^0[689]\d{8}$/;
const PHONE_INPUT_CHARACTERS = /^[0-9\s-]+$/;

export function normalizeThaiPhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

function formatDigits(digits: string, fixedLine: boolean): string {
  const firstGroupLength = fixedLine ? 2 : 3;
  const limitedDigits = digits.slice(0, fixedLine ? 9 : 10);
  const first = limitedDigits.slice(0, firstGroupLength);
  const second = limitedDigits.slice(firstGroupLength, firstGroupLength + 3);
  const third = limitedDigits.slice(firstGroupLength + 3);
  return [first, second, third].filter(Boolean).join("-");
}

export function formatThaiPhoneInput(value: string): string {
  const digits = normalizeThaiPhoneNumber(value);
  return formatDigits(digits, digits.startsWith("02"));
}

export function isValidThaiPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !PHONE_INPUT_CHARACTERS.test(trimmed)) return false;
  const digits = normalizeThaiPhoneNumber(trimmed);
  return THAI_FIXED_LINE_PATTERN.test(digits) || THAI_TEN_DIGIT_PATTERN.test(digits);
}

export function shouldShowThaiPhoneValidationError(value: string): boolean {
  const digits = normalizeThaiPhoneNumber(value);
  if (isValidThaiPhoneNumber(value)) return false;
  if (digits.length === 10) return true;
  if (digits.length !== 9) return false;
  return !/^0[689]/.test(digits);
}

export function formatThaiPhoneNumber(value: string): string {
  if (!isValidThaiPhoneNumber(value)) return value.trim();
  const digits = normalizeThaiPhoneNumber(value);
  return formatDigits(digits, digits.length === 9);
}
