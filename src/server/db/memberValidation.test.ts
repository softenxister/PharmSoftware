import assert from "node:assert/strict";
import test from "node:test";
import { parseMemberProfileInput } from "./memberValidation";

test("member profile input trims valid names and mobile numbers", () => {
  assert.deepEqual(
    parseMemberProfileInput({ name: "  Nicha Kittisak  ", mobile: " 084-903-2258 " }),
    { name: "Nicha Kittisak", mobile: "084-903-2258" },
  );
});

test("member profile input rejects missing and malformed required values", () => {
  assert.equal(parseMemberProfileInput({ name: "", mobile: "084-903-2258" }), null);
  assert.equal(parseMemberProfileInput({ name: "Nicha Kittisak", mobile: "invalid" }), null);
  assert.equal(parseMemberProfileInput(null), null);
});
