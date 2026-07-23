import assert from "node:assert/strict";
import test from "node:test";
import {
  NORMALIZED_PRODUCT_CATEGORIES,
  normalizeProductCategory,
} from "./productCategoryNormalization";

test("normalized categories have separate English and Thai labels and exclude household medicine", () => {
  assert.ok(NORMALIZED_PRODUCT_CATEGORIES.length > 0);
  assert.ok(NORMALIZED_PRODUCT_CATEGORIES.every(({ nameEn, nameTh }) => (
    nameEn.length > 0 && /[\u0E00-\u0E7F]/.test(nameTh)
  )));
  assert.ok(!NORMALIZED_PRODUCT_CATEGORIES.some(({ nameEn, nameTh }) => (
    /household medicine/i.test(nameEn) || nameTh.includes("ยาสามัญประจำบ้าน")
  )));
});

test("household-medicine products map by therapeutic use instead of regulatory label", () => {
  assert.equal(normalizeProductCategory({
    itemName: "BAKAMOL 500MG.10'S.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Pain & Fever Relief");
  assert.equal(normalizeProductCategory({
    itemName: "ANTACIL GEL HH 240ML",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Gastrointestinal Medicines");
  assert.equal(normalizeProductCategory({
    itemName: "BROWN MIXTURE ยาแก้ไอน้ำดำตรางู 120ML.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "Cold, Cough, Allergy & Respiratory");
  assert.equal(normalizeProductCategory({
    itemName: "BETADINE 30CC.",
    sourceCategory: "ยาสามัญประจำบ้าน",
  }), "First Aid & Wound Care");
});

test("legal and supplier source groups do not become normalized product categories", () => {
  assert.equal(normalizeProductCategory({
    itemName: "AMOXICILLIN 500MG.10'S.",
    sourceCategory: "ยาอันตราย*#2",
  }), "Anti-infective Medicines");
  assert.equal(normalizeProductCategory({
    itemName: "DENTISTE ยาสีฟัน 100G.",
    sourceCategory: "DENTISTE*",
  }), "Oral & Dental Care");
  assert.equal(normalizeProductCategory({
    itemName: "2P OH MY BLUSH V2-01 ALMOND 5G.",
    sourceCategory: "2P*",
  }), "Personal Care & Cosmetics");
});

test("unknown products use one broad fallback instead of an invented specific category", () => {
  assert.equal(normalizeProductCategory({
    itemName: "UNKNOWN PHARMACY PRODUCT X1",
    sourceCategory: "Uncategorized",
  }), "Other Medicines & Health Products");
});

test("an explicitly selected normalized fallback category remains stable", () => {
  assert.equal(normalizeProductCategory({
    itemName: "PARACETAMOL SAMPLE",
    sourceCategory: "Other Medicines & Health Products",
  }), "Other Medicines & Health Products");
});
