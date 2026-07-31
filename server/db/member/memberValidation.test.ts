import assert from "node:assert/strict";
import test from "node:test";
import { parseMemberProfileInput } from "./memberValidation";

test("member profile input trims names and stores a canonical Thai phone format", () => {
  assert.deepEqual(
    parseMemberProfileInput({ name: "  Nicha Kittisak  ", mobile: " 0849032258 " }),
    { name: "Nicha Kittisak", mobile: "084-903-2258" },
  );
  assert.deepEqual(
    parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "021234567" }),
    { name: "Nicha Kittisak", mobile: "02-123-4567" },
  );
  assert.deepEqual(
    parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "095-8382352,081-4362858" }),
    { name: "Nicha Kittisak", mobile: "095-838-2352,081-436-2858" },
  );
});

test("member profile input rejects missing and malformed required values", () => {
  assert.equal(parseMemberProfileInput({ name: "", mobile: "084-903-2258" }), null);
  assert.equal(parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "invalid" }), null);
  assert.equal(parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "071-234-5678" }), null);
  assert.equal(parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "081-234-567" }), null);
  assert.equal(parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "081-234-5678,bad" }), null);
  assert.equal(parseMemberProfileInput(null), null);
});

test("member profile input accepts unique standardized allergy IDs and rejects duplicates", () => {
  assert.deepEqual(
    parseMemberProfileInput({
      name: "Nicha Kittisak",
      mobile: "084-903-2258",
      allergyIngredientIds: ["ingredient-paracetamol", "ingredient-cetirizine"],
    }),
    {
      name: "Nicha Kittisak",
      mobile: "084-903-2258",
      allergyIngredientIds: ["ingredient-paracetamol", "ingredient-cetirizine"],
    },
  );
  assert.equal(parseMemberProfileInput({
    name: "Nicha Kittisak",
    mobile: "084-903-2258",
    allergyIngredientIds: ["ingredient-paracetamol", " ingredient-paracetamol "],
  }), null);
});

test("member profile input accepts a validated profile image and rejects unsafe image data", () => {
  const avatarUrl = "data:image/png;base64,iVBORw0KGgo=";

  assert.deepEqual(
    parseMemberProfileInput({
      name: "Nicha Kittisak",
      mobile: "084-903-2258",
      avatarUrl,
    }),
    {
      name: "Nicha Kittisak",
      mobile: "084-903-2258",
      avatarUrl,
    },
  );
  assert.equal(parseMemberProfileInput({
    name: "Nicha Kittisak",
    mobile: "084-903-2258",
    avatarUrl: "data:text/html;base64,PHNjcmlwdD4=",
  }), null);
});
