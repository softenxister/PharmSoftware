import assert from "node:assert/strict";
import test from "node:test";
import {
  DOSAGE_FORMS,
  inferProductDosageForm,
  isStoredDosageForm,
  resolveDosageFormSelection,
} from "./productDosageForm";

test("dosage forms use the agreed controlled vocabulary", () => {
  assert.deepEqual(DOSAGE_FORMS, [
    "Tablet",
    "Capsule",
    "Powder",
    "Syrup",
    "Suspension",
    "Solution",
    "Drops",
    "Cream",
    "Ointment",
    "Gel",
    "Lotion",
    "Spray",
    "Inhaler",
    "Injection",
    "Suppository",
    "Patch",
  ]);
  assert.equal(isStoredDosageForm("Tablet"), true);
  assert.equal(isStoredDosageForm("Not Applicable"), true);
  assert.equal(isStoredDosageForm("Unclassified"), true);
  assert.equal(isStoredDosageForm("ml"), false);
  assert.equal(isStoredDosageForm("box"), false);
});

test("tablet and capsule units classify solid medicines", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "Unbranded medicine",
    category: "Other Medicines & Health Products",
    childUnit: "เม็ด",
  }), { dosageForm: "Tablet" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "Unbranded medicine",
    category: "Other Medicines & Health Products",
    childUnit: "capsule",
  }), { dosageForm: "Capsule" });
});

test("explicit tablet and capsule names repair only the opposite count unit", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "CLINDAMYCIN CAPSULE 300MG",
    category: "Anti-infective Medicines",
    childUnit: "tablet",
  }), { dosageForm: "Capsule", correctedChildUnit: "capsule" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "PARACETAMOL TABLETS 500MG",
    category: "Pain & Fever Relief",
    childUnit: "แคปซูล",
  }), { dosageForm: "Tablet", correctedChildUnit: "tablet" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "BOCYTIN CAPSULE 375MG",
    category: "Other Medicines & Health Products",
    childUnit: "box",
  }), { dosageForm: "Capsule" });
});

test("non-medicine category gates prevent texture and device false positives", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "BABY QTO แคปซูลรีฟิลกันยุง 4ชิ้น",
    category: "Personal Care & Cosmetics",
    childUnit: "piece",
  }), { dosageForm: "Not Applicable" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "เครื่องพ่นยา NE-C28",
    category: "Medical Devices & Diagnostics",
    childUnit: "set",
  }), { dosageForm: "Not Applicable" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "FUNGAZOL SHAMPOO 150ML",
    category: "Personal Care & Cosmetics",
    childUnit: "ml",
    hasIngredientEvidence: true,
  }), { dosageForm: "Lotion" });
});

test("specific names classify regardless of extreme package volume", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "ALDA SYRUP 10ML",
    category: "Cold, Cough, Allergy & Respiratory",
    childUnit: "ml",
    childQuantity: 10,
  }), { dosageForm: "Syrup" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "BELCID SUSPENSION 1000ML",
    category: "Gastrointestinal Medicines",
    childUnit: "ml",
    childQuantity: 1000,
  }), { dosageForm: "Suspension" });
});

test("grouped aliases resolve to their broader dosage form families", () => {
  const cases = [
    ["EUGICA LOZENGE 8'S", "Tablet"],
    ["SINGULAIR ORAL GRANULE 4MG", "Powder"],
    ["BISOLVON ELIXIR 60ML", "Solution"],
    ["KANOLONE ORAL PASTE 5G", "Ointment"],
    ["FUNGIDERM SHAMPOO 100ML", "Lotion"],
    ["BERODUAL SOLUTION FOR INHALATION", "Inhaler"],
    ["BRONAL SUSP 60ML", "Suspension"],
    ["AMPAVIT INJ 1ML", "Injection"],
    ["ARTEOPTIC E/D 5ML", "Drops"],
  ] as const;
  for (const [itemName, dosageForm] of cases) {
    assert.equal(inferProductDosageForm({
      itemName,
      category: "Other Medicines & Health Products",
      childUnit: "piece",
    }).dosageForm, dosageForm);
  }
});

test("curated compound phrases win while unknown conflicts stay unclassified", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "BETADINE DRY POWDER SPRAY 55G",
    category: "First Aid & Wound Care",
    childUnit: "g",
  }), { dosageForm: "Spray" });
  assert.deepEqual(inferProductDosageForm({
    itemName: "EXAMPLE CREAM GEL",
    category: "Dermatological Medicines",
    childUnit: "g",
  }), { dosageForm: "Unclassified" });
});

test("ml and ingredient evidence do not invent a liquid dosage form", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "AMBROLEX 60ML",
    genericName: "Ambroxol",
    category: "Cold, Cough, Allergy & Respiratory",
    childUnit: "ml",
    childQuantity: 60,
    hasIngredientEvidence: true,
  }), { dosageForm: "Unclassified" });
});

test("Thai FDA dosage form has automatic priority over local heuristics", () => {
  assert.deepEqual(inferProductDosageForm({
    itemName: "EXAMPLE GEL",
    category: "Dermatological Medicines",
    childUnit: "g",
    thaiFdaDosageForm: "film-coated tablet",
  }), { dosageForm: "Tablet" });
});


test("manual selections stay authoritative and changed selections become manual", () => {
  assert.deepEqual(resolveDosageFormSelection({
    requestedDosageForm: "Cream",
    current: { dosageForm: "Cream", source: "MANUAL" },
    inferred: { dosageForm: "Ointment" },
  }), { dosageForm: "Cream", source: "MANUAL" });
  assert.deepEqual(resolveDosageFormSelection({
    requestedDosageForm: "Gel",
    current: { dosageForm: "Cream", source: "INFERRED" },
    inferred: { dosageForm: "Cream" },
  }), { dosageForm: "Gel", source: "MANUAL" });
  assert.deepEqual(resolveDosageFormSelection({
    requestedDosageForm: "Unclassified",
    current: null,
    inferred: { dosageForm: "Capsule" },
  }), { dosageForm: "Capsule", source: "INFERRED" });
  assert.deepEqual(resolveDosageFormSelection({
    requestedDosageForm: "Unclassified",
    current: { dosageForm: "Tablet", source: "INFERRED" },
    inferred: { dosageForm: "Tablet" },
  }), { dosageForm: "Unclassified", source: "MANUAL" });
});
