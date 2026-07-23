import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStockCategoryOptions,
  canonicalizeStockCategory,
  filterByStockCategories,
  getStockCategoryLabel,
  getStockCategoryOptions,
} from "./stockCategoryFilter";

test("English and Thai expose the same canonical category values one-to-one", () => {
  const englishOptions = getStockCategoryOptions("en");
  const thaiOptions = getStockCategoryOptions("th");

  assert.equal(englishOptions.length, thaiOptions.length);
  assert.deepEqual(
    englishOptions.map((option) => option.value),
    thaiOptions.map((option) => option.value),
  );
  assert.equal(
    thaiOptions.find((option) => option.value === "Cold, Cough, Allergy & Respiratory")?.label,
    "ยาแก้หวัด ไอ ภูมิแพ้ และระบบทางเดินหายใจ",
  );
  assert.ok(thaiOptions.every((option) => /[\u0E00-\u0E7F]/.test(option.label)));
  assert.ok(!buildStockCategoryOptions(["Cold, Cough & Allergy"]).includes("Cold, Cough & Allergy"));
  assert.ok(!englishOptions.some((option) => /household medicine/i.test(option.label)));
  assert.ok(!thaiOptions.some((option) => option.label.includes("ยาสามัญประจำบ้าน")));
});

test("overlapping legacy category names canonicalize without changing stored products", () => {
  const items = [
    { id: "pain", category: "Pain Relief" },
    { id: "sara", category: "Allergy & Cold" },
    { id: "tiffy", category: "Cold, Cough & Allergy" },
  ];

  assert.deepEqual(filterByStockCategories(items, []), items);
  assert.deepEqual(
    filterByStockCategories(items, ["Allergy & Cold"]).map((item) => item.id),
    ["sara", "tiffy"],
  );
  assert.equal(
    canonicalizeStockCategory("Cold, Cough & Allergy"),
    "Cold, Cough, Allergy & Respiratory",
  );
  assert.equal(
    getStockCategoryLabel("th", "Cold, Cough & Allergy"),
    "ยาแก้หวัด ไอ ภูมิแพ้ และระบบทางเดินหายใจ",
  );
});
