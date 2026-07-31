import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductMeasurementNormalizationPlan,
  type ProductMeasurementNormalizationCandidate,
} from "./productMeasurementNormalizationRepository";

const candidates: ProductMeasurementNormalizationCandidate[] = [
  {
    id: "bromhex",
    itemName: "Bromhex Tablets10/ แผง",
    currentPackUnit: "blisterpack",
    currentChildQuantity: 1,
    currentChildUnit: "blisterpack",
    currentPackLabel: "1 blisterpack",
  },
  {
    id: "syrup",
    itemName: "Bromhexine syrup 4 mg/5 ml 60ml",
    currentPackUnit: "bottle",
    currentChildQuantity: 1,
    currentChildUnit: "bottle",
    currentPackLabel: "1 bottle",
  },
  {
    id: "already-normalized",
    itemName: "Bisoltab 10'S (bromhexine8mg)",
    currentPackUnit: "box",
    currentChildQuantity: 10,
    currentChildUnit: "tablet",
    currentPackLabel: "10 tablet",
  },
  {
    id: "unmatched",
    itemName: "Unrecognized pharmacy item",
    currentPackUnit: "blisterpack",
    currentChildQuantity: 1,
    currentChildUnit: "blisterpack",
    currentPackLabel: "1 blisterpack",
  },
];

test("measurement normalization persists confident quantities and subunits only", () => {
  const plan = buildProductMeasurementNormalizationPlan(candidates);

  assert.deepEqual(plan, {
    evaluatedCount: 4,
    changedCount: 2,
    unchangedCount: 2,
    changes: [
      {
        productId: "bromhex",
        childQuantity: 10,
        childUnit: "tablet",
        packLabel: "10 tablet",
      },
      {
        productId: "syrup",
        childQuantity: 60,
        childUnit: "ml",
        packLabel: "60 ml",
      },
    ],
  });
});
