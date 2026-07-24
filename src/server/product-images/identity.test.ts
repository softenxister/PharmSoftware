import assert from "node:assert/strict";
import test from "node:test";
import {
  compareProductImageEvidence,
  normalizeGtin,
  normalizeIdentityText,
} from "./identity";

test("normalizes valid GTIN family identifiers to GTIN-14", () => {
  assert.equal(normalizeGtin("96385074"), "00000096385074");
  assert.equal(normalizeGtin("036000291452"), "00036000291452");
  assert.equal(normalizeGtin("4006381333931"), "04006381333931");
  assert.equal(normalizeGtin("0 4006381-33393 1"), "04006381333931");
});

test("rejects unsupported, malformed, and bad-check-digit identifiers", () => {
  assert.equal(normalizeGtin("4006381333932"), null);
  assert.equal(normalizeGtin("12345"), null);
  assert.equal(normalizeGtin("ABC-4006381333931"), null);
  assert.equal(normalizeGtin("00000000"), null);
});

test("normalizes Thai and English identity text without losing Thai characters", () => {
  assert.equal(
    normalizeIdentityText("  TYLENOL® 500 มก. (10's)  "),
    "tylenol 500 มก 10 s",
  );
});

test("allows automatic publication only for an exact identifier with no hard conflicts", () => {
  const result = compareProductImageEvidence({
    product: {
      gtin: "8850000000010",
      productName: "Tylenol 500 mg 10 tablets",
      brand: "Tylenol",
      manufacturer: "Kenvue",
      strength: "500 mg",
      dosageForm: "tablet",
      packCount: "10",
      market: "TH",
      packageLevel: "EACH",
    },
    candidate: {
      gtin: "8850000000010",
      productName: "Tylenol 500mg 10 Tablets",
      brand: "TYLENOL",
      manufacturer: "Kenvue",
      strength: "500mg",
      dosageForm: "Tablets",
      packCount: "10",
      market: "TH",
      packageLevel: "EACH",
    },
    sourceLicence: "CC BY-SA 3.0",
    matchMethod: "EXACT_GTIN",
  });

  assert.equal(result.decision, "AUTO_PUBLISH");
  assert.deepEqual(result.conflicts, []);
  assert.ok(result.agreements.includes("gtin"));
});

test("hard identity conflicts reject even an exact GTIN candidate", () => {
  for (const [field, value] of [
    ["strength", "650 mg"],
    ["dosageForm", "capsule"],
    ["packCount", "20"],
    ["brand", "Panadol"],
    ["manufacturer", "Other Company"],
    ["market", "US"],
    ["packageLevel", "CASE"],
  ] as const) {
    const result = compareProductImageEvidence({
      product: {
        gtin: "4006381333931",
        brand: "Tylenol",
        manufacturer: "Kenvue",
        strength: "500 mg",
        dosageForm: "tablet",
        packCount: "10",
        market: "TH",
        packageLevel: "EACH",
      },
      candidate: {
        gtin: "4006381333931",
        brand: "Tylenol",
        manufacturer: "Kenvue",
        strength: "500 mg",
        dosageForm: "tablet",
        packCount: "10",
        market: "TH",
        packageLevel: "EACH",
        [field]: value,
      },
      sourceLicence: "CC BY-SA 3.0",
      matchMethod: "EXACT_GTIN",
    });

    assert.equal(result.decision, "REJECT", field);
    assert.ok(result.conflicts.includes(field), field);
  }
});

test("text matching can create review evidence but never auto-publishes", () => {
  const result = compareProductImageEvidence({
    product: {
      productName: "Tylenol 500 mg 10 tablets",
      brand: "Tylenol",
      strength: "500 mg",
      dosageForm: "tablet",
      packCount: "10",
    },
    candidate: {
      productName: "Tylenol 500mg tablets x10",
      brand: "Tylenol",
      strength: "500mg",
      dosageForm: "tablet",
      packCount: "10",
    },
    sourceLicence: "CC BY-SA 3.0",
    matchMethod: "TEXT",
  });

  assert.equal(result.decision, "REVIEW");
  assert.equal(result.autoPublishEligible, false);
});

test("missing or unapproved reuse licence cannot auto-publish", () => {
  const result = compareProductImageEvidence({
    product: { gtin: "4006381333931", brand: "Example" },
    candidate: { gtin: "4006381333931", brand: "Example" },
    sourceLicence: "",
    matchMethod: "EXACT_GTIN",
  });

  assert.equal(result.decision, "REVIEW");
  assert.equal(result.autoPublishEligible, false);
  assert.ok(result.missing.includes("sourceLicence"));
});
