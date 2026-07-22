import assert from "node:assert/strict";
import test from "node:test";
import { extractThaiPharmacyBrand, resolveImportedBrandName } from "./thaiBrandExtractor";
import { THAI_PHARMACY_BRAND_RULES } from "./thaiPharmacyBrandAliases";

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

test("extracts a Thai brand embedded in a concatenated product name", () => {
  assert.equal(extractThaiPharmacyBrand("กระต่ายบิน totral 30 ml").brandName, "กระต่ายบิน");
  assert.equal(extractThaiPharmacyBrand("ยาธาตุนํ้าขาวกระต่ายบิน 450 ml").brandName, "กระต่ายบิน");
});

test("extracts every registered Thai brand when concatenated with a product description", () => {
  assert.equal(extractThaiPharmacyBrand("ยาธาตุน้ำขาวไทยนคร 50ML.").brandName, "ไทยนคร");
  assert.equal(extractThaiPharmacyBrand("ยาดมสมุนไพรหงส์ไทยสูตร 1").brandName, "หงส์ไทย");
  assert.equal(extractThaiPharmacyBrand("คอลเกตน้ำยาบ้วนปากพลักซ์ 750มล.").brandName, "Colgate");

  for (const rule of THAI_PHARMACY_BRAND_RULES) {
    for (const alias of rule.aliases.filter((candidate) => /\p{Script=Thai}/u.test(candidate))) {
      assert.equal(
        extractThaiPharmacyBrand(`ผลิตภัณฑ์${alias}สูตร`).brandName,
        rule.brandName,
        `Expected concatenated alias ${alias} to map to ${rule.brandName}`,
      );
    }
  }
});

test("keeps Latin and numeric aliases limited to complete words", () => {
  assert.equal(extractThaiPharmacyBrand("ยาน้ำ 3ml").brandName, null);
});

test("does not match a Thai alias embedded inside a different name or description", () => {
  assert.equal(extractThaiPharmacyBrand("ยาธาตุน้ำแดงตราเสือดาว 60 cc").brandName, null);
  assert.equal(extractThaiPharmacyBrand("ยาบรรเทาอาการปวดเมื่อยตราเสือดำ 150ซีซี").brandName, null);
  assert.equal(extractThaiPharmacyBrand("ยาน้ำตราเสือ 11 ตัว สูตร111").brandName, null);
  assert.equal(extractThaiPharmacyBrand("ยาชงตรางามระหง 60G.30ซอง").brandName, null);
  assert.equal(extractThaiPharmacyBrand("รถเข็นอัลลอยด์ลายสก๊อต รุ่นKY863").brandName, null);
  assert.equal(extractThaiPharmacyBrand("สก๊อตไบรต์ ฟองน้ำใยขัด 6ชิ้น").brandName, null);
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
