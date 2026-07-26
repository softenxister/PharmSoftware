import assert from "node:assert/strict";
import test from "node:test";
import { canonicalIngredient } from "./ingredientNormalization";

test("ingredient salts resolve to the stable allergy ingredient identity", () => {
  assert.equal(canonicalIngredient("CHLORPHENIRAMINE MALEATE").id, "ingredient-chlorpheniramine");
  assert.equal(canonicalIngredient("PHENYLEPHRINE HCL").id, "ingredient-phenylephrine");
  assert.equal(canonicalIngredient("GLUCOSE ANHYDROUS").id, "ingredient-glucose");
});
