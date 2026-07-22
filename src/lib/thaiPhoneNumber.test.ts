import assert from "node:assert/strict";
import test from "node:test";
import {
  formatThaiPhoneInput,
  formatThaiPhoneNumberList,
  formatThaiPhoneNumberListInput,
  formatThaiPhoneNumber,
  isValidThaiPhoneNumberList,
  isValidThaiPhoneNumber,
  normalizeThaiPhoneNumber,
  shouldShowThaiPhoneNumberListValidationError,
  shouldShowThaiPhoneValidationError,
} from "./thaiPhoneNumber";

test("normalizes Thai phone input to digits", () => {
  assert.equal(normalizeThaiPhoneNumber(" 081-234-5678 "), "0812345678");
  assert.equal(normalizeThaiPhoneNumber("081 234 56789"), "08123456789");
  assert.equal(normalizeThaiPhoneNumber("phone"), "");
});

test("formats complete Thai fixed-line and mobile numbers", () => {
  assert.equal(formatThaiPhoneNumber("021234567"), "02-123-4567");
  assert.equal(formatThaiPhoneNumber("0812345678"), "081-234-5678");
  assert.equal(formatThaiPhoneNumber("09-1234-5678"), "091-234-5678");
});

test("formats phone numbers progressively while typing", () => {
  assert.equal(formatThaiPhoneInput("02123"), "02-123");
  assert.equal(formatThaiPhoneInput("0812345"), "081-234-5");
  assert.equal(formatThaiPhoneInput("08123456789"), "081-234-5678");
});

test("accepts Thai 02 fixed lines and 06, 08, or 09 ten-digit numbers", () => {
  assert.equal(isValidThaiPhoneNumber("02-123-4567"), true);
  assert.equal(isValidThaiPhoneNumber("061-234-5678"), true);
  assert.equal(isValidThaiPhoneNumber("0812345678"), true);
  assert.equal(isValidThaiPhoneNumber("091-234-5678"), true);
});

test("accepts, formats, and progressively edits comma-separated Thai phone numbers", () => {
  assert.equal(isValidThaiPhoneNumberList("095-8382352,081-4362858"), true);
  assert.equal(formatThaiPhoneNumberList("095-8382352, 0814362858"), "095-838-2352,081-436-2858");
  assert.equal(formatThaiPhoneNumberListInput("0958382352,081436"), "095-838-2352,081-436");
  assert.equal(shouldShowThaiPhoneNumberListValidationError("095-838-2352,071-234-5678"), true);
  assert.equal(isValidThaiPhoneNumberList("095-838-2352,071-234-5678"), false);
});

test("rejects invalid Thai phone lengths and prefixes", () => {
  assert.equal(isValidThaiPhoneNumber("02-123-456"), false);
  assert.equal(isValidThaiPhoneNumber("071-234-5678"), false);
  assert.equal(isValidThaiPhoneNumber("081-234-567"), false);
  assert.equal(isValidThaiPhoneNumber("181-234-5678"), false);
  assert.equal(isValidThaiPhoneNumber("081abc2345678"), false);
});

test("shows validation feedback only for complete invalid 9 or 10 digit input", () => {
  assert.equal(shouldShowThaiPhoneValidationError("071-234-5678"), true);
  assert.equal(shouldShowThaiPhoneValidationError("031-234-567"), true);
  assert.equal(shouldShowThaiPhoneValidationError("071-234-567"), true);
  assert.equal(shouldShowThaiPhoneValidationError("081-234-567"), false);
  assert.equal(shouldShowThaiPhoneValidationError("071-234-56"), false);
  assert.equal(shouldShowThaiPhoneValidationError("081-234-5678"), false);
  assert.equal(shouldShowThaiPhoneValidationError("02-123-4567"), false);
});
