import { canonicalizeProductUnit } from "@/i18n/productUnits";

export const DOSAGE_FORMS = [
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
] as const;

export const DOSAGE_FORM_STATUSES = ["Not Applicable", "Unclassified"] as const;

export type DosageForm = (typeof DOSAGE_FORMS)[number];
export type DosageFormStatus = (typeof DOSAGE_FORM_STATUSES)[number];
export type StoredDosageForm = DosageForm | DosageFormStatus;
export type DosageFormSource = "INFERRED" | "THAI_FDA" | "MANUAL";

export type ProductDosageFormEvidence = {
  itemName: string;
  genericName?: string;
  category: string;
  childUnit: string;
  childQuantity?: number;
  hasIngredientEvidence?: boolean;
  thaiFdaDosageForm?: string;
};

export type InferredProductDosageForm = {
  dosageForm: StoredDosageForm;
  correctedChildUnit?: "tablet" | "capsule";
};

const STORED_DOSAGE_FORMS = new Set<string>([...DOSAGE_FORMS, ...DOSAGE_FORM_STATUSES]);
const NON_MEDICINE_CATEGORIES = new Set([
  "personal care & cosmetics",
  "medical devices & diagnostics",
]);

const ENGLISH_FORM_PATTERNS: ReadonlyArray<[DosageForm, RegExp]> = [
  ["Tablet", /(?:^|[^\p{L}\p{M}])(?:tablets?|tabs?\.?|caplets?|lozenges?|troches?)(?=$|[^\p{L}\p{M}])/iu],
  ["Capsule", /(?:^|[^\p{L}\p{M}])(?:capsules?|caps?\.?)(?=$|[^\p{L}\p{M}])/iu],
  ["Powder", /(?:^|[^\p{L}\p{M}])(?:powders?|pwd\.?|granules?|gran\.?)(?=$|[^\p{L}\p{M}])/iu],
  ["Syrup", /(?:^|[^\p{L}\p{M}])syrups?(?=$|[^\p{L}\p{M}])/iu],
  ["Suspension", /(?:^|[^\p{L}\p{M}])(?:suspensions?|susp\.?)(?=$|[^\p{L}\p{M}])/iu],
  ["Solution", /(?:^|[^\p{L}\p{M}])(?:solutions?|soln\.?|elixirs?|emulsions?|gargles?|enemas?)(?=$|[^\p{L}\p{M}])/iu],
  ["Drops", /(?:^|[^\p{L}\p{M}])(?:drops?|e\s*\/\s*d\.?)(?=$|[^\p{L}\p{M}])/iu],
  ["Cream", /(?:^|[^\p{L}\p{M}])creams?(?=$|[^\p{L}\p{M}])/iu],
  ["Ointment", /(?:^|[^\p{L}\p{M}])(?:ointments?|oint\.?|pastes?|balms?)(?=$|[^\p{L}\p{M}])/iu],
  ["Gel", /(?:^|[^\p{L}\p{M}])gels?(?=$|[^\p{L}\p{M}])/iu],
  ["Lotion", /(?:^|[^\p{L}\p{M}])(?:lotions?|shampoos?|medicated\s+oils?)(?=$|[^\p{L}\p{M}])/iu],
  ["Spray", /(?:^|[^\p{L}\p{M}])sprays?(?=$|[^\p{L}\p{M}])/iu],
  ["Inhaler", /(?:^|[^\p{L}\p{M}])(?:inhalers?|mdi)(?=$|[^\p{L}\p{M}])/iu],
  ["Injection", /(?:^|[^\p{L}\p{M}])(?:injections?|injectable|inj\.?)(?=$|[^\p{L}\p{M}])/iu],
  ["Suppository", /(?:^|[^\p{L}\p{M}])(?:suppositor(?:y|ies)|pessar(?:y|ies))(?=$|[^\p{L}\p{M}])/iu],
  ["Patch", /(?:^|[^\p{L}\p{M}])(?:patch(?:es)?|transdermal)(?=$|[^\p{L}\p{M}])/iu],
];

const THAI_FORM_TERMS: ReadonlyArray<[DosageForm, readonly string[]]> = [
  ["Tablet", ["เม็ด", "ยาอม"]],
  ["Capsule", ["แคปซูล"]],
  ["Powder", ["ชนิดผง", "ผงยา", "ชนิดเกล็ด"]],
  ["Syrup", ["น้ำเชื่อม", "ไซรัป"]],
  ["Suspension", ["แขวนตะกอน"]],
  ["Solution", ["ยาน้ำรับประทาน", "ยากลั้วคอ", "ยาสวน"]],
  ["Drops", ["ชนิดหยด", "ยาหยอด", "หยอดตา", "หยอดหู"]],
  ["Cream", ["ครีม"]],
  ["Ointment", ["ขี้ผึ้ง", "ยาหม่อง"]],
  ["Gel", ["เจล"]],
  ["Lotion", ["โลชั่น", "แชมพู"]],
  ["Spray", ["สเปรย์"]],
  ["Inhaler", ["ยาสูด", "ยาดม", "น้ำยาพ่น"]],
  ["Injection", ["ยาฉีด"]],
  ["Suppository", ["ยาเหน็บ"]],
  ["Patch", ["แผ่นแปะ"]],
];

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

export function isStoredDosageForm(value: unknown): value is StoredDosageForm {
  return typeof value === "string" && STORED_DOSAGE_FORMS.has(value);
}

function matchingForms(value: string): DosageForm[] {
  const text = normalized(value);
  if (!text) return [];
  const matches = new Set<DosageForm>();
  for (const [dosageForm, pattern] of ENGLISH_FORM_PATTERNS) {
    if (pattern.test(text)) matches.add(dosageForm);
  }
  for (const [dosageForm, terms] of THAI_FORM_TERMS) {
    if (terms.some((term) => text.includes(term))) matches.add(dosageForm);
  }
  return [...matches];
}

function curatedCompoundForm(value: string): DosageForm | null {
  const text = normalized(value);
  if (/(?:dry\s+powder\s+spray|powder\s+spray)/u.test(text)) return "Spray";
  if (/(?:solution\s+for\s+inhalation|inhalation\s+solution|nebuliz(?:er|ation)\s+solution)/u.test(text)) {
    return "Inhaler";
  }
  if (/powder\s+for\s+(?:oral\s+)?suspension/u.test(text)) return "Suspension";
  if (/(?:powder|solution)\s+for\s+injection/u.test(text)) return "Injection";
  return null;
}

function formFromText(value: string): DosageForm | null | "conflict" {
  const compound = curatedCompoundForm(value);
  if (compound) return compound;
  const matches = matchingForms(value);
  if (matches.length === 0) return null;
  return matches.length === 1 ? matches[0] : "conflict";
}

function thaiFdaForm(value: string): DosageForm | null {
  const compound = curatedCompoundForm(value);
  if (compound) return compound;
  const matches = matchingForms(value);
  if (matches.length === 1) return matches[0];
  return normalized(value).includes("oral liquid") ? "Solution" : null;
}

function correctedSolidUnit(
  dosageForm: DosageForm,
  childUnit: string,
): InferredProductDosageForm["correctedChildUnit"] {
  const unit = canonicalizeProductUnit(childUnit);
  if (dosageForm === "Capsule" && unit === "tablet") return "capsule";
  if (dosageForm === "Tablet" && unit === "capsule") return "tablet";
  return undefined;
}

export function inferProductDosageForm(
  evidence: ProductDosageFormEvidence,
): InferredProductDosageForm {
  const officialForm = evidence.thaiFdaDosageForm
    ? thaiFdaForm(evidence.thaiFdaDosageForm)
    : null;
  if (officialForm) return { dosageForm: officialForm };

  const itemForm = formFromText(evidence.itemName);
  const genericForm = itemForm === null && evidence.genericName
    ? formFromText(evidence.genericName)
    : null;
  const explicitForm = itemForm ?? genericForm;
  const hasIngredientEvidence = Boolean(
    evidence.hasIngredientEvidence || evidence.genericName?.trim(),
  );
  const strongMedicinalForm = explicitForm !== null
    && explicitForm !== "conflict"
    && ["Syrup", "Suspension", "Injection", "Suppository"].includes(explicitForm);
  if (
    NON_MEDICINE_CATEGORIES.has(normalized(evidence.category))
    && !hasIngredientEvidence
    && !strongMedicinalForm
  ) {
    return { dosageForm: "Not Applicable" };
  }

  if (explicitForm === "conflict") return { dosageForm: "Unclassified" };
  if (explicitForm) {
    const correctedChildUnit = correctedSolidUnit(explicitForm, evidence.childUnit);
    return {
      dosageForm: explicitForm,
      ...(correctedChildUnit ? { correctedChildUnit } : {}),
    };
  }

  const unit = canonicalizeProductUnit(evidence.childUnit);
  if (unit === "tablet") return { dosageForm: "Tablet" };
  if (unit === "capsule") return { dosageForm: "Capsule" };
  return { dosageForm: "Unclassified" };
}

type DosageFormSelectionInput = {
  requestedDosageForm: StoredDosageForm;
  current: { dosageForm: StoredDosageForm; source: DosageFormSource } | null;
  inferred: InferredProductDosageForm;
};

export function resolveDosageFormSelection({
  requestedDosageForm,
  current,
  inferred,
}: DosageFormSelectionInput): { dosageForm: StoredDosageForm; source: DosageFormSource } {
  if (current?.source === "MANUAL" && requestedDosageForm === current.dosageForm) {
    return current;
  }
  if (
    (current && requestedDosageForm !== current.dosageForm)
    || (!current && requestedDosageForm !== "Unclassified")
  ) {
    return { dosageForm: requestedDosageForm, source: "MANUAL" };
  }
  if (current?.source === "THAI_FDA" && requestedDosageForm === current.dosageForm) {
    return current;
  }
  return { dosageForm: inferred.dosageForm, source: "INFERRED" };
}
