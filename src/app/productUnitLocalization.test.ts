import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_PACKAGE_VALUES,
  PRODUCT_SUBUNIT_VALUES,
  PRODUCT_UNIT_VALUES,
  canonicalizeProductUnit,
  replaceDeprecatedProductUnit,
  formatProductPackLabel,
  formatProductPackRelation,
  localizeProductUnit,
  localizeUnitExpression,
} from "./i18n/productUnits";

const THAI_DATABASE_UNITS = [
  "กล่อง", "ขวด", "แผง", "หลอด", "ซอง", "แพ็ค", "โหล", "อัน", "ลัง", "ชุด",
  "ห่อ", "เม็ด", "กป.", "ชิ้น", "ถุง", "ม้วน", "ใบ", "กระปุก", "แท่ง", "ตลับ",
  "กระป๋อง", "แคปซูล", "เครื่อง", "ก้อน", "แผ่น", "กล่องใหญ่", "แกลลอน", "แพ็คx12",
  "แพ็คx6", "คู่", "ตัว", "แพ็คx3", "ลูก", "เส้น", "คัน", "แพ็คคู่", "แพ็คx2",
  "ท่อ", "กระบอก", "กก.", "หน่วย", "กระเช้า", "กระสอบ", "ผืน", "ดวง", "ตู้", "แพ็คx36",
] as const;

const ENGLISH_DATABASE_UNITS = [
  "VIAL", "box", "tablet", "PEN.", "blister", "blisterpack", "bottle", "ml", "tab",
  "tube", "g", "piece", "sachet", "caplet",
] as const;

test("every known database and selectable unit renders only in the selected language", () => {
  const values = [
    ...THAI_DATABASE_UNITS,
    ...ENGLISH_DATABASE_UNITS,
    ...PRODUCT_UNIT_VALUES,
    ...PRODUCT_PACKAGE_VALUES,
    ...PRODUCT_SUBUNIT_VALUES,
  ];

  for (const value of values) {
    const english = localizeProductUnit("en", value);
    const thai = localizeProductUnit("th", value);

    assert.doesNotMatch(english, /[\u0E00-\u0E7F]/, `English output for ${value}: ${english}`);
    assert.match(thai, /[\u0E00-\u0E7F]/, `Thai output for ${value}: ${thai}`);
    assert.doesNotMatch(thai, /[A-Za-z]/, `Thai output for ${value}: ${thai}`);
  }
});

test("overly specific unit choices remap to the closest remaining unit", () => {
  const replacements = [
    ["caplet", "tablet", "tablet", "เม็ด"],
    ["container", "jar", "jar", "กระปุก"],
    ["vial", "bottle", "bottle", "ขวด"],
    ["pen", "piece", "piece", "ชิ้น"],
    ["ampoule", "bottle", "bottle", "ขวด"],
    ["syringe", "piece", "piece", "ชิ้น"],
    ["strip", "blisterpack", "blister pack", "แผง"],
    ["drop", "bottle", "bottle", "ขวด"],
    ["dose", "piece", "piece", "ชิ้น"],
    ["puff", "piece", "piece", "ชิ้น"],
    ["spray", "bottle", "bottle", "ขวด"],
    ["patch", "sheet", "sheet", "แผ่น"],
    ["suppository", "piece", "piece", "ชิ้น"],
    ["cc", "ml", "ml", "มล."],
  ] as const;

  for (const [source, canonical, english, thai] of replacements) {
    assert.equal(canonicalizeProductUnit(source), canonical, source);
    assert.equal(replaceDeprecatedProductUnit(source), canonical, source);
    assert.equal(localizeProductUnit("en", source), english, source);
    assert.equal(localizeProductUnit("th", source), thai, source);
  }
  assert.equal(localizeProductUnit("en", "mg"), "unit");
  assert.equal(localizeProductUnit("th", "mg"), "หน่วย");
  assert.equal(localizeProductUnit("en", "mcg"), "unit");
  assert.equal(localizeProductUnit("th", "mcg"), "หน่วย");
  assert.equal(replaceDeprecatedProductUnit("mg"), "piece");
  assert.equal(replaceDeprecatedProductUnit("ขวด"), "ขวด");
});

test("measurements are selectable only as subunits", () => {
  for (const measurement of ["kg", "g", "ml", "l"]) {
    assert.ok(PRODUCT_SUBUNIT_VALUES.includes(measurement), measurement);
    assert.ok(!PRODUCT_UNIT_VALUES.includes(measurement), measurement);
    assert.ok(!PRODUCT_PACKAGE_VALUES.includes(measurement), measurement);
  }
  for (const forbidden of ["mg", "mcg", "cc"]) {
    assert.ok(!PRODUCT_SUBUNIT_VALUES.includes(forbidden), forbidden);
    assert.ok(!PRODUCT_UNIT_VALUES.includes(forbidden), forbidden);
    assert.ok(!PRODUCT_PACKAGE_VALUES.includes(forbidden), forbidden);
  }
});

test("selectable unit lists contain no deleted labels or duplicate bottle label", () => {
  const deletedThaiLabels = [
    "เม็ดรี", "ภาชนะ", "ขวดไวอัล", "ปากกา", "แอมพูล", "กระบอกฉีดยา", "แถบ", "หยด",
    "โดส", "ครั้ง", "สเปรย์", "แผ่นแปะ", "ยาเหน็บ", "มก.", "มคก.", "ซีซี",
  ];
  const deletedEnglishLabels = [
    "caplet", "container", "vial", "pen", "ampoule", "syringe", "strip", "drop", "dose",
    "puff", "spray", "patch", "suppository", "mg", "mcg", "cc",
  ];

  for (const values of [PRODUCT_UNIT_VALUES, PRODUCT_PACKAGE_VALUES, PRODUCT_SUBUNIT_VALUES]) {
    const thaiLabels = values.map((value) => localizeProductUnit("th", value));
    const englishLabels = values.map((value) => localizeProductUnit("en", value));
    assert.deepEqual(thaiLabels.filter((label) => label === "ขวด"), ["ขวด"]);
    for (const label of deletedThaiLabels) assert.ok(!thaiLabels.includes(label), label);
    for (const label of deletedEnglishLabels) assert.ok(!englishLabels.includes(label), label);
  }
});

test("Thai classifiers and quantity-decorated packs normalize to fewer English units", () => {
  for (const value of ["อัน", "ใบ", "ตัว", "ลูก", "เส้น", "คัน", "ผืน", "ดวง", "หน่วย"]) {
    assert.equal(localizeProductUnit("en", value), "piece");
  }
  for (const value of ["แพ็ค", "ห่อ", "โหล", "แพ็คคู่", "แพ็คx2", "แพ็คx3", "แพ็คx6", "แพ็คx12", "แพ็คx36"]) {
    assert.equal(localizeProductUnit("en", value), "pack");
  }
  assert.equal(localizeProductUnit("en", "กล่องใหญ่"), "box");
  assert.equal(localizeProductUnit("en", "กป."), "jar");
});

test("unit expressions translate quantities, bracket multipliers, and pack relations", () => {
  assert.equal(localizeUnitExpression("en", "กล่อง[12]"), "box[12]");
  assert.equal(localizeUnitExpression("th", "box[12]"), "กล่อง[12]");
  assert.equal(localizeUnitExpression("en", "10 เม็ด"), "10 tablets");
  assert.equal(localizeUnitExpression("th", "10 tablets"), "10 เม็ด");
  assert.equal(localizeUnitExpression("en", "1 กล่อง = 10 แผง"), "1 box = 10 blister packs");
  assert.equal(localizeUnitExpression("th", "1 box = 10 blister packs"), "1 กล่อง = 10 แผง");
  assert.equal(localizeUnitExpression("en", "10 / แผง"), "10 / blister packs");
  assert.equal(localizeUnitExpression("th", "10 / blisterpack"), "10 / แผง");
  assert.equal(localizeUnitExpression("en", "กล่อง(12)"), "box(12)");
  assert.equal(localizeUnitExpression("th", "box(12)"), "กล่อง(12)");
});

test("structured pack formatters never depend on a stored display label", () => {
  assert.equal(formatProductPackLabel("en", 10, "เม็ด"), "10 tablets");
  assert.equal(formatProductPackLabel("th", 10, "tablet"), "10 เม็ด");
  assert.equal(formatProductPackRelation("en", "กล่อง", 10, "แผง"), "1 box = 10 blister packs");
  assert.equal(formatProductPackRelation("th", "box", 10, "blisterpack"), "1 กล่อง = 10 แผง");
});

test("unknown cross-language values fail closed instead of leaking the wrong script", () => {
  assert.equal(localizeProductUnit("th", "future-unit"), "หน่วย");
  assert.equal(localizeProductUnit("en", "หน่วยใหม่"), "unit");
});
