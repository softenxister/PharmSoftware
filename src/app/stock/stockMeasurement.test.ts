import assert from "node:assert/strict";
import test from "node:test";
import { localizeUnitExpression } from "@/app/i18n/productUnits";
import {
  extractProductMeasurement,
  getStockMeasurementLabel,
} from "@/lib/productMeasurement";

const fallbackPack = {
  packUnit: "blisterpack",
  childUnit: "blisterpack",
  childQuantity: 1,
  label: "1 blisterpack",
};

test("apostrophe counts become tablet quantities instead of one blister pack", () => {
  const source = {
    itemName: "Bromhx 8 MG 10's",
    pack: fallbackPack,
  };
  const measurement = extractProductMeasurement(source);
  const label = getStockMeasurementLabel(source);

  assert.deepEqual(measurement, { quantity: 10, unit: "tablet", label: "10 tablet" });
  assert.equal(localizeUnitExpression("en", label), "10 tablets");
  assert.equal(localizeUnitExpression("th", label), "10 เม็ด");
});

test("counts written after the dosage form are extracted from imported Bromhex labels", () => {
  const label = getStockMeasurementLabel({
    itemName: "Bromhex Tablets10/ แผง",
    pack: fallbackPack,
  });

  assert.equal(localizeUnitExpression("en", label), "10 tablets");
  assert.equal(localizeUnitExpression("th", label), "10 เม็ด");
});

test("explicit English and Thai count units retain their meaning", () => {
  assert.equal(localizeUnitExpression("en", getStockMeasurementLabel({
    itemName: "3M NEXCARE COOLING FEVER ผู้ใหญ่ 6ชิ้น",
    pack: fallbackPack,
  })), "6 pieces");
  assert.equal(localizeUnitExpression("th", getStockMeasurementLabel({
    itemName: "THROATSIL ชนิดซอง 8เม็ด",
    pack: fallbackPack,
  })), "8 เม็ด");
  assert.equal(localizeUnitExpression("en", getStockMeasurementLabel({
    itemName: "Herbal powder 12 sachets",
    pack: fallbackPack,
  })), "12 sachets");
});

test("net volume and weight are extracted while medicine strength is ignored", () => {
  assert.equal(getStockMeasurementLabel({
    itemName: "Bromhexine syrup 4 mg/5 ml 60ml",
    pack: { ...fallbackPack, packUnit: "bottle", childUnit: "bottle", label: "1 bottle" },
  }), "60 ml");
  assert.equal(getStockMeasurementLabel({
    itemName: "Gentle cleansing cream 200 g",
    pack: { ...fallbackPack, packUnit: "tube", childUnit: "tube", label: "1 tube" },
  }), "200 g");
  assert.equal(getStockMeasurementLabel({
    itemName: "Children syrup 125 mg/5 ml",
    pack: { ...fallbackPack, packUnit: "bottle", childUnit: "bottle", label: "1 bottle" },
  }), "1 bottle");
});

test("existing informative pack labels remain available when names have no package measurement", () => {
  assert.equal(getStockMeasurementLabel({
    itemName: "Paracetamol 500 mg tablets",
    pack: {
      packUnit: "blisterpack",
      childUnit: "tablet",
      childQuantity: 10,
      label: "10 tablets",
    },
  }), "10 tablets");
  assert.equal(getStockMeasurementLabel({
    itemName: "Unrecognized pharmacy item",
    pack: fallbackPack,
  }), "1 blisterpack");
  assert.equal(extractProductMeasurement({
    itemName: "Unrecognized pharmacy item",
    pack: fallbackPack,
  }), null);
});
