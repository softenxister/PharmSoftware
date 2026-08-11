import assert from "node:assert/strict";
import test from "node:test";
import { classifyStockRegulatoryForms } from "./stockRegulatoryRecords";

test("regulatory records always include purchase ledger ข.ย. 9", () => {
  assert.deepEqual(classifyStockRegulatoryForms({}), ["ข.ย. 9"]);
});

test("specially controlled products require ข.ย. 10", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาควบคุมพิเศษ",
  }), ["ข.ย. 9", "ข.ย. 10"]);
});

test("verified designated dangerous-drug ingredients require ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Dextromethorphan Hydrobromide" }],
    dosageType: "tablet",
  }), ["ข.ย. 9", "ข.ย. 11"]);
});

test("designated antihistamines require ข.ย. 11 only in a verified liquid form", () => {
  const input = {
    legalCategory: "ยาอันตราย",
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Chlorpheniramine Maleate" }],
  } as const;

  assert.deepEqual(classifyStockRegulatoryForms({ ...input, dosageType: "syrup" }), [
    "ข.ย. 9",
    "ข.ย. 11",
  ]);
  assert.deepEqual(classifyStockRegulatoryForms({ ...input, dosageType: "tablet" }), ["ข.ย. 9"]);
  assert.deepEqual(classifyStockRegulatoryForms({ ...input, dosageType: "bottle" }), ["ข.ย. 9"]);
});

test("unverified compositions fail closed for ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    activeIngredients: [{ canonicalName: "Tramadol Hydrochloride" }],
    dosageType: "capsule",
  }), ["ข.ย. 9"]);
});
