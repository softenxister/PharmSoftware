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
  }), ["ข.ย. 9", "ข.ย. 11"]);
});

test("designated antihistamines require ข.ย. 11 without dosage-form evidence", () => {
  const input = {
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Chlorpheniramine Maleate" }],
  } as const;

  assert.deepEqual(classifyStockRegulatoryForms(input), [
    "ข.ย. 9",
    "ข.ย. 11",
  ]);
});

test("all eleven named antihistamines require ข.ย. 11 in combination formulations", () => {
  const antihistamines = [
    "Brompheniramine",
    "Carbinoxamine",
    "Chlorpheniramine",
    "Cyproheptadine",
    "Dexchlorpheniramine",
    "Dimenhydrinate",
    "Diphenhydramine",
    "Doxylamine",
    "Hydroxyzine",
    "Promethazine",
    "Triprolidine",
  ];

  for (const canonicalName of antihistamines) {
    assert.deepEqual(classifyStockRegulatoryForms({
      compositionStatus: "verified",
      activeIngredients: [
        { canonicalName },
        { canonicalName: "Paracetamol" },
      ],
    }), ["ข.ย. 9", "ข.ย. 11"], canonicalName);
  }
});

test("unverified compositions fail closed for ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    activeIngredients: [{ canonicalName: "Tramadol Hydrochloride" }],
  }), ["ข.ย. 9"]);
});

test("extracted imported combination ingredients can require ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    importedIngredients: [
      { canonicalName: "Dextromethorphan" },
      { canonicalName: "Guaifenesin" },
    ],
  }), ["ข.ย. 9", "ข.ย. 11"]);
});

test("extracted imported antihistamines require ข.ย. 11 without category or dosage evidence", () => {
  const input = {
    compositionStatus: "pending",
    importedIngredients: [
      { canonicalName: "Chlorpheniramine Maleate" },
      { canonicalName: "Ammonium Chloride" },
    ],
  } as const;

  assert.deepEqual(classifyStockRegulatoryForms(input), [
    "ข.ย. 9",
    "ข.ย. 11",
  ]);
});

test("verified ingredients take priority over imported generic-name ingredients", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Paracetamol" }],
    importedIngredients: [{ canonicalName: "Dextromethorphan" }],
  }), ["ข.ย. 9"]);
});

test("unlisted extracted combination ingredients do not require ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาอันตราย",
    compositionStatus: "pending",
    importedIngredients: [
      { canonicalName: "Glipizide" },
      { canonicalName: "Metformin" },
    ],
  }), ["ข.ย. 9"]);
});

test("special-control status and a reportable ingredient require both ข.ย. 10 and ข.ย. 11", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    legalCategory: "ยาควบคุมพิเศษ",
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Tramadol Hydrochloride" }],
  }), ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"]);
});

test("corticosteroids require ข.ย. 11 only in a single-ingredient formulation", () => {
  const dexamethasone = { canonicalName: "Dexamethasone" };

  assert.deepEqual(classifyStockRegulatoryForms({
    compositionStatus: "verified",
    activeIngredients: [dexamethasone],
  }), ["ข.ย. 9", "ข.ย. 11"]);
  assert.deepEqual(classifyStockRegulatoryForms({
    compositionStatus: "verified",
    activeIngredients: [dexamethasone, { canonicalName: "Chloramphenicol" }],
  }), ["ข.ย. 9"]);

  assert.deepEqual(classifyStockRegulatoryForms({
    compositionStatus: "verified",
    activeIngredients: [{ canonicalName: "Desoxymethasone" }],
  }), ["ข.ย. 9", "ข.ย. 11"]);
});

test("PDE5 medicines require ข.ย. 11 only in a single-ingredient formulation", () => {
  for (const canonicalName of ["Sildenafil Citrate", "Tadalafil", "Vardenafil Hydrochloride"]) {
    assert.deepEqual(classifyStockRegulatoryForms({
      compositionStatus: "verified",
      activeIngredients: [{ canonicalName }],
    }), ["ข.ย. 9", "ข.ย. 11"]);
    assert.deepEqual(classifyStockRegulatoryForms({
      compositionStatus: "verified",
      activeIngredients: [{ canonicalName }, { canonicalName: "Dapoxetine" }],
    }), ["ข.ย. 9"]);
  }
});

test("an unsplit imported combination never qualifies as PDE5 monotherapy", () => {
  assert.deepEqual(classifyStockRegulatoryForms({
    compositionStatus: "pending",
    importedIngredients: [{ canonicalName: "Sildenafil / Dapoxetine" }],
  }), ["ข.ย. 9"]);
});
