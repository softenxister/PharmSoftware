import assert from "node:assert/strict";
import test from "node:test";
import { extractThaiPharmacyBrand, resolveImportedBrandName } from "./thaiBrandExtractor";

test("extracts approved English aliases anywhere in a mixed-language product name", () => {
  assert.deepEqual(extractThaiPharmacyBrand("3D MASK unicharm ซองชมพูสำหรับเด็ก"), {
    brandName: "Unicharm",
    confidence: "high",
    matchedAlias: "unicharm",
    method: "alias",
  });
  assert.equal(extractThaiPharmacyBrand("3M NEXCARE COOLING FEVER ผู้ใหญ่ 6ชิ้น").brandName, "3M");
});

test("normalizes Thai and romanized spellings to one canonical Thai brand", () => {
  for (const name of ["ไทยนคร ยาเม็ด", "THAINAKORN herbal tablet", "Thai Nakorn balm"]) {
    assert.equal(extractThaiPharmacyBrand(name).brandName, "ไทยนคร");
  }
  assert.equal(extractThaiPharmacyBrand("ยาธาตุน้ำขาว ตรากระต่ายบิน").brandName, "กระต่ายบิน");
  assert.equal(extractThaiPharmacyBrand("ระดมพล ยาหม่อง").brandName, "ระดมพล");
});

test("removes packaging prefixes before using the leading-brand fallback", () => {
  const result = extractThaiPharmacyBrand("(ฺฺBox) BURAPHA Topamine syrup grape 60ml");
  assert.equal(result.brandName, "BURAPHA");
  assert.equal(result.confidence, "high");
});

test("does not invent a brand from packaging and generic description tokens", () => {
  assert.deepEqual(extractThaiPharmacyBrand("3D KID FACE MASK 10ชิ้น"), {
    brandName: null,
    confidence: "review",
    matchedAlias: null,
    method: "none",
  });
  assert.equal(extractThaiPharmacyBrand("100% Silicone stomuch no.16").brandName, null);
  assert.equal(extractThaiPharmacyBrand("3D KID FACE MASK/10ชิ้น").brandName, null);
  assert.equal(extractThaiPharmacyBrand("3D MASK หน้ากากป้องกันPM2.5 4ชิ้น").brandName, null);
});

test("keeps a leading three-digit brand as a reviewable suggestion", () => {
  assert.deepEqual(extractThaiPharmacyBrand("246 รักษาเกลื้อน"), {
    brandName: "246",
    confidence: "medium",
    matchedAlias: "246",
    method: "leading-token",
  });
});

test("re-import replaces copied item names but preserves a manually curated brand", () => {
  assert.equal(resolveImportedBrandName({
    extractedBrandName: "Unicharm",
    existingBrandName: "3D MASK unicharm ซองชมพูสำหรับเด็ก",
    existingItemName: "3D MASK unicharm ซองชมพูสำหรับเด็ก",
  }), "Unicharm");
  assert.equal(resolveImportedBrandName({
    extractedBrandName: null,
    existingBrandName: "Manually verified brand",
    existingItemName: "Generic product description",
  }), "Manually verified brand");
  assert.equal(resolveImportedBrandName({
    extractedBrandName: null,
    existingBrandName: "Generic product description",
    existingItemName: "Generic product description",
  }), "Unspecified");
});
