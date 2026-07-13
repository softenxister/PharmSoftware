import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionPurchaseStatus } from "@/lib/purchaseWorkflow";
import { resolvePharmUser } from "@/server/auth/pharmUser";
import {
  isValidCorrectionRequestInput,
  isValidStockAdjustmentInput,
} from "./purchaseCorrectionValidation";

test("a purchase must be prepared before it can be completed", () => {
  assert.equal(canTransitionPurchaseStatus("draft", "partial"), true);
  assert.equal(canTransitionPurchaseStatus("draft", "received"), false);
  assert.equal(canTransitionPurchaseStatus("partial", "received"), true);
});

test("a prepared purchase can return to draft but a completed purchase is immutable", () => {
  assert.equal(canTransitionPurchaseStatus("partial", "draft"), true);
  assert.equal(canTransitionPurchaseStatus("received", "draft"), false);
  assert.equal(canTransitionPurchaseStatus("received", "partial"), false);
});

test("server role policy defaults to staff and accepts only known manager roles", () => {
  assert.deepEqual(resolvePharmUser({}), { name: "Pharmacy staff", role: "staff", canManageStock: false });
  assert.deepEqual(resolvePharmUser({ PHARM_USER_ROLE: "owner", PHARM_USER_NAME: "Narin" }), {
    name: "Narin",
    role: "owner",
    canManageStock: true,
  });
  assert.equal(resolvePharmUser({ PHARM_USER_ROLE: "superuser" }).role, "staff");
});

test("a normal correction request requires a purchase id and a useful reason", () => {
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "purchase-1", reason: "Wrong free quantity" }), true);
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "purchase-1", reason: "bad" }), false);
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "", reason: "Wrong free quantity" }), false);
});

test("a stock adjustment requires a reason and at least one finite non-negative quantity", () => {
  const validLine = { productId: "product-1", batchNo: "LOT-1", newQuantity: 18 };
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [validLine],
  }), true);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{ productId: "product-1", batchNo: "LOT-1", newQuantity: -1 }],
  }), false);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "short",
    lines: [],
  }), false);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [validLine, validLine],
  }), false);
});
