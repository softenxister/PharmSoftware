import { canonicalizeProductUnit } from "@/app/i18n/productUnits";
import type { SalesProduct } from "@/server/db/types";

export type ProductMeasurementSource = Pick<SalesProduct, "itemName" | "pack">;

export type ExtractedProductMeasurement = {
  quantity: number;
  unit: string;
  label: string;
};

type MeasurementCandidate = {
  index: number;
  quantity: string;
  unit: string;
};

const QUANTITY_SOURCE = String.raw`\d+(?:[.,]\d+)?`;
const COUNT_UNIT_SOURCE = [
  "blister\\s*packs?", "tablets?", "caplets?", "capsules?", "sachets?", "pieces?",
  "blisters?", "strips?", "sheets?", "bottles?", "tubes?", "pairs?", "rolls?",
  "sticks?", "packs?", "tabs?", "caps?", "pcs?\\.?", "sets?", "bars?",
  "แคปซูล", "ชิ้น", "เม็ด", "ซอง", "แผ่น", "ขวด", "หลอด", "แผง", "แพ็ค",
  "คู่", "ม้วน", "แท่ง", "ชุด", "ก้อน", "อัน",
].join("|");
const METRIC_UNIT_SOURCE = [
  "kilograms?", "millilit(?:er|re)s?", "lit(?:er|re)s?", "grams?",
  "kg", "ml", "cc", "g", "l", "กก\\.?", "กรัม", "มล\\.?", "ลิตร", "ซีซี",
].join("|");

const COUNT_PATTERN = new RegExp(
  `(${QUANTITY_SOURCE})\\s*(${COUNT_UNIT_SOURCE})(?=$|[^\\p{L}\\p{M}\\p{N}])`,
  "giu",
);
const METRIC_PATTERN = new RegExp(
  `(${QUANTITY_SOURCE})\\s*(${METRIC_UNIT_SOURCE})(?=$|[^\\p{L}\\p{M}\\p{N}])`,
  "giu",
);
const APOSTROPHE_COUNT_PATTERN = new RegExp(
  `(${QUANTITY_SOURCE})\\s*['’]\\s*s(?=$|[^\\p{L}\\p{M}\\p{N}])`,
  "giu",
);
const DOSAGE_FORM_TRAILING_COUNT_PATTERN = new RegExp(
  `(tablets?|tabs?|caplets?|capsules?|caps?|เม็ด|แคปซูล)\\s*(${QUANTITY_SOURCE})(?=\\s*(?:\\/|$|[()[\\],;]))`,
  "giu",
);

function normalizedUnitKey(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function canonicalCountUnit(value: string): string {
  const unit = normalizedUnitKey(value);
  if (/^(?:tablet|tab|caplet)s?$/.test(unit) || unit === "เม็ด") return "tablet";
  if (/^(?:capsule|cap)s?$/.test(unit) || unit === "แคปซูล") return "capsule";
  if (/^(?:sachet)s?$/.test(unit) || unit === "ซอง") return "sachet";
  if (/^(?:sheet)s?$/.test(unit) || unit === "แผ่น") return "sheet";
  if (/^(?:bottle)s?$/.test(unit) || unit === "ขวด") return "bottle";
  if (/^(?:tube)s?$/.test(unit) || unit === "หลอด") return "tube";
  if (/^(?:blister pack|blister|strip)s?$/.test(unit) || unit === "แผง") return "blisterpack";
  if (/^(?:pack)s?$/.test(unit) || unit === "แพ็ค") return "pack";
  if (/^(?:pair)s?$/.test(unit) || unit === "คู่") return "pair";
  if (/^(?:roll)s?$/.test(unit) || unit === "ม้วน") return "roll";
  if (/^(?:stick)s?$/.test(unit) || unit === "แท่ง") return "stick";
  if (/^(?:set)s?$/.test(unit) || unit === "ชุด") return "set";
  if (/^(?:bar)s?$/.test(unit) || unit === "ก้อน") return "bar";
  return "piece";
}

function canonicalMetricUnit(value: string): string {
  const unit = normalizedUnitKey(value);
  if (/^(?:kilogram)s?$/.test(unit) || unit === "kg" || unit === "กก") return "kg";
  if (/^(?:gram)s?$/.test(unit) || unit === "g" || unit === "กรัม") return "g";
  if (/^(?:liter|litre)s?$/.test(unit) || unit === "l" || unit === "ลิตร") return "l";
  return "ml";
}

function numericQuantity(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function inferApostropheCountUnit(source: ProductMeasurementSource): string {
  const itemName = source.itemName.toLocaleLowerCase("en-US");
  if (/(?:capsules?|\bcaps?\b|แคปซูล)/u.test(itemName)) return "capsule";
  if (/(?:tablets?|\btabs?\b|caplets?|เม็ด)/u.test(itemName)) return "tablet";
  const packUnit = canonicalizeProductUnit(source.pack.packUnit);
  const childUnit = canonicalizeProductUnit(source.pack.childUnit);
  if (packUnit === "blisterpack" || childUnit === "blisterpack") return "tablet";
  if (childUnit === "tablet" || childUnit === "capsule") return childUnit;
  if (/\d+(?:[.,]\d+)?\s*(?:mg|mcg|มก\.?|มคก\.?)(?=$|[^\p{L}\p{M}\p{N}])/iu.test(itemName)) {
    return "tablet";
  }
  return "piece";
}

function extractMeasurementCandidates(source: ProductMeasurementSource): MeasurementCandidate[] {
  const candidates: MeasurementCandidate[] = [];

  for (const match of source.itemName.matchAll(COUNT_PATTERN)) {
    if (numericQuantity(match[1]) <= 1) continue;
    candidates.push({
      index: match.index,
      quantity: match[1],
      unit: canonicalCountUnit(match[2]),
    });
  }

  for (const match of source.itemName.matchAll(METRIC_PATTERN)) {
    const precedingText = source.itemName.slice(Math.max(0, match.index - 10), match.index);
    if (/(?:\/|\bper\s*)$/iu.test(precedingText)) continue;
    candidates.push({
      index: match.index,
      quantity: match[1],
      unit: canonicalMetricUnit(match[2]),
    });
  }

  for (const match of source.itemName.matchAll(APOSTROPHE_COUNT_PATTERN)) {
    if (numericQuantity(match[1]) <= 1) continue;
    candidates.push({
      index: match.index,
      quantity: match[1],
      unit: inferApostropheCountUnit(source),
    });
  }

  for (const match of source.itemName.matchAll(DOSAGE_FORM_TRAILING_COUNT_PATTERN)) {
    if (numericQuantity(match[2]) <= 1) continue;
    candidates.push({
      index: match.index,
      quantity: match[2],
      unit: canonicalCountUnit(match[1]),
    });
  }

  return candidates;
}

export function extractProductMeasurement(
  source: ProductMeasurementSource,
): ExtractedProductMeasurement | null {
  const extracted = extractMeasurementCandidates(source)
    .sort((left, right) => left.index - right.index)
    .at(-1);
  if (!extracted) return null;

  const quantity = numericQuantity(extracted.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99_999_999_999) return null;
  return {
    quantity,
    unit: extracted.unit,
    label: `${quantity} ${extracted.unit}`,
  };
}

export function getStockMeasurementLabel(source: ProductMeasurementSource): string {
  return extractProductMeasurement(source)?.label ?? source.pack.label;
}
