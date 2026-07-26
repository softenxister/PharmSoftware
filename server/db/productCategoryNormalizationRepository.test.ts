import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductCategoryNormalizationPlan,
  type ProductCategoryNormalizationCandidate,
} from "./productCategoryNormalizationRepository";

const candidates: ProductCategoryNormalizationCandidate[] = [
  {
    id: "other-to-pain",
    itemName: "Paracetamol 500 mg tablets",
    brandName: "",
    genericName: null,
    currentCategory: "Other Medicines & Health Products",
  },
  {
    id: "existing-to-dental",
    itemName: "Sensodyne toothpaste",
    brandName: "Sensodyne",
    genericName: null,
    currentCategory: "Cardiovascular Medicines",
  },
  {
    id: "ingredient-to-diabetes",
    itemName: "Generic tablet 500 mg",
    brandName: "",
    genericName: "Metformin",
    currentCategory: "Other Medicines & Health Products",
  },
  {
    id: "unmatched-stays-other",
    itemName: "Unrecognized pharmacy item",
    brandName: "",
    genericName: null,
    currentCategory: "Other Medicines & Health Products",
  },
  {
    id: "already-correct",
    itemName: "Ibuprofen 200 mg",
    brandName: "",
    genericName: null,
    currentCategory: "Pain & Fever Relief",
  },
];

test("category normalization updates every confident match and preserves unmatched categories", () => {
  const plan = buildProductCategoryNormalizationPlan(candidates);

  assert.deepEqual(plan, {
    evaluatedCount: 5,
    changedCount: 3,
    unchangedCount: 2,
    changes: [
      { productId: "other-to-pain", categoryName: "Pain & Fever Relief" },
      { productId: "existing-to-dental", categoryName: "Oral & Dental Care" },
      { productId: "ingredient-to-diabetes", categoryName: "Diabetes & Endocrine Medicines" },
    ],
  });
});
