import assert from "node:assert/strict";
import test from "node:test";
import {
  getProductCompositionRows,
  shouldShowImportedGenericName,
  splitImportedGenericName,
} from "./productComposition";

test("splits plus-separated imported generic names into ingredient rows", () => {
  assert.deepEqual(
    splitImportedGenericName("chlorpheniramine + paracetamol + phenylephrine"),
    ["chlorpheniramine", "paracetamol", "phenylephrine"],
  );
});

test("splits comma-separated imported generic names into ingredient rows", () => {
  assert.deepEqual(
    splitImportedGenericName("amoxicillin, clavulanic acid, potassium clavulanate"),
    ["amoxicillin", "clavulanic acid", "potassium clavulanate"],
  );
});

test("ignores empty segments while preserving a single imported generic name", () => {
  assert.deepEqual(splitImportedGenericName("  paracetamol  "), ["paracetamol"]);
  assert.deepEqual(splitImportedGenericName("paracetamol + , caffeine"), [
    "paracetamol",
    "caffeine",
  ]);
});

test("uses imported generic-name parts as rows when verified ingredients are unavailable", () => {
  assert.deepEqual(getProductCompositionRows([], "paracetamol+caffeine"), [
    { id: "imported-generic-1", canonicalName: "paracetamol" },
    { id: "imported-generic-2", canonicalName: "caffeine" },
  ]);
});

test("keeps verified ingredient rows instead of duplicating imported generic-name parts", () => {
  const verifiedIngredients = [{
    id: "ingredient-paracetamol",
    canonicalName: "Paracetamol",
    thaiName: "พาราเซตามอล",
    strength: "500 mg",
  }];

  assert.equal(
    getProductCompositionRows(verifiedIngredients, "paracetamol+caffeine"),
    verifiedIngredients,
  );
});

test("uses persisted imported ingredient rows before parsing the raw source again", () => {
  const persistedIngredients = [
    { id: "ingredient-glipizide", canonicalName: "Glipizide" },
    { id: "ingredient-metformin", canonicalName: "Metformin" },
  ];

  assert.equal(
    getProductCompositionRows([], "wrong+raw+value", persistedIngredients),
    persistedIngredients,
  );
});

test("hides the original imported row after a combined generic name is extracted", () => {
  assert.equal(shouldShowImportedGenericName("Glipizide+Metformin"), false);
  assert.equal(shouldShowImportedGenericName("ingredient a, ingredient b"), false);
});

test("keeps the imported row for a single generic name", () => {
  assert.equal(shouldShowImportedGenericName("Glipizide"), true);
});
