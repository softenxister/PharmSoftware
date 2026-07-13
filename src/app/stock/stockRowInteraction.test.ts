import assert from "node:assert/strict";
import test from "node:test";
import { isStockRowActivationKey } from "./stockRowInteraction";

test("stock rows activate edit from Enter or Space only", () => {
  assert.equal(isStockRowActivationKey("Enter"), true);
  assert.equal(isStockRowActivationKey(" "), true);
  assert.equal(isStockRowActivationKey("Escape"), false);
});
