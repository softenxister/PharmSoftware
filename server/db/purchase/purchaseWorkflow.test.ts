import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionPurchaseStatus } from "@/lib/purchaseWorkflow";
import { canManageStoreSettings, toPharmUser } from "@server/auth/pharmUser";
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

const account = {
  id: "account-1",
  name: "Narin",
  username: "narin",
  phone: "",
  pharmacistLicenseNumber: null,
  avatarUrl: null,
  isActive: true,
  mustChangePassword: false,
};

test("server role policy grants direct stock changes only to the owner", () => {
  assert.equal(toPharmUser({ ...account, role: "pharmacist" }).canManageStock, false);
  assert.equal(toPharmUser({ ...account, role: "owner" }).canManageStock, true);
});

test("only owner-level accounts can change store-wide POS settings", () => {
  assert.equal(canManageStoreSettings(toPharmUser({ ...account, role: "pharmacist" })), false);
  assert.equal(canManageStoreSettings(toPharmUser({ ...account, role: "owner" })), true);
});

test("a normal correction request requires a purchase id and a useful reason", () => {
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "purchase-1", reason: "Wrong free quantity" }), true);
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "purchase-1", reason: "bad" }), false);
  assert.equal(isValidCorrectionRequestInput({ purchaseBillId: "", reason: "Wrong free quantity" }), false);
});

test("a stock adjustment requires a reason and at least one finite non-negative quantity", () => {
  const validLine = {
    productId: "product-1",
    batchNo: "LOT-1",
    expiryDate: "2028-01-01",
    newQuantity: 18,
  };
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [validLine],
  }), true);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{ ...validLine, newQuantity: -1 }],
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
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{ ...validLine, expiryDate: "2029-01-01" }, validLine],
  }), true);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{ productId: "product-1", batchNo: "LOT-1", newQuantity: 18 }],
  }), false);
});

test("a purchase stock correction accepts a null batch with a required expiry", () => {
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{
      productId: "product-1",
      batchNo: null,
      expiryDate: "2028-01-01",
      newQuantity: 18,
    }],
  }), true);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{
      productId: "product-1",
      batchNo: null,
      expiryDate: "",
      newQuantity: 18,
    }],
  }), false);
  assert.equal(isValidStockAdjustmentInput({
    purchaseBillId: "purchase-1",
    reason: "Correct quantity after invoice review",
    lines: [{
      productId: "product-1",
      batchNo: null,
      expiryDate: "02/12/2029",
      newQuantity: 18,
    }],
  }), false);
});
