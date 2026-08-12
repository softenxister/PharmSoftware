import assert from "node:assert/strict";
import test from "node:test";
import { classifyProductRegulatoryForms } from "./productRegulatoryClassification";

const LIQUID_UNITS = {
  unit: "bottle",
  subUnit: "ml",
} as const;

test("edit-item classification checks ข.ย. 11 from an extracted imported ingredient", () => {
  assert.deepEqual(classifyProductRegulatoryForms({
    ...LIQUID_UNITS,
    variant: "edit-row",
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    genericName: "Dextromethorphan+Guaifenesin",
  }), ["ข.ย. 9", "ข.ย. 11"]);
});

test("create-item classification does not use imported generic-name fallback", () => {
  assert.deepEqual(classifyProductRegulatoryForms({
    ...LIQUID_UNITS,
    variant: "default",
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    genericName: "Dextromethorphan+Guaifenesin",
  }), ["ข.ย. 9"]);
});

test("verified ingredients override imported generic-name fallback in edit item", () => {
  assert.deepEqual(classifyProductRegulatoryForms({
    ...LIQUID_UNITS,
    variant: "edit-row",
    legalCategory: "ยาอันตราย",
    compositionStatus: "verified",
    activeIngredients: [{
      id: "ingredient-paracetamol",
      canonicalName: "Paracetamol",
      sourceName: "Thai FDA",
      sourceUrl: "https://example.test/verified-product",
    }],
    genericName: "Dextromethorphan+Guaifenesin",
  }), ["ข.ย. 9"]);
});

test("persisted imported ingredients drive edit-item classification before raw parsing", () => {
  assert.deepEqual(classifyProductRegulatoryForms({
    ...LIQUID_UNITS,
    variant: "edit-row",
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    importedIngredients: [{
      id: "ingredient-dextromethorphan",
      canonicalName: "Dextromethorphan",
      sourceName: "CW stock import",
      sourceValue: "Dextromethorphan",
    }],
    genericName: "Glipizide+Metformin",
  }), ["ข.ย. 9", "ข.ย. 11"]);
});
