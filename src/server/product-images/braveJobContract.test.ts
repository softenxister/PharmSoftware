import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BRAVE_IMAGE_SEARCH_PRODUCTS,
  parseBraveImageSearchRunInput,
} from "./braveJobContract";

test("accepts a whole-number Brave run limit from 1 through 1000", () => {
  assert.deepEqual(parseBraveImageSearchRunInput({ limit: 1 }), { limit: 1 });
  assert.deepEqual(
    parseBraveImageSearchRunInput({ limit: MAX_BRAVE_IMAGE_SEARCH_PRODUCTS }),
    { limit: 1000 },
  );
});

test("rejects missing, fractional, non-numeric, and out-of-range limits", () => {
  for (const input of [
    null,
    {},
    { limit: "10" },
    { limit: 1.5 },
    { limit: 0 },
    { limit: 1001 },
    { limit: Number.NaN },
  ]) {
    assert.equal(parseBraveImageSearchRunInput(input), null);
  }
});
