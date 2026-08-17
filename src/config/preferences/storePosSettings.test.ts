import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STORE_POS_SETTINGS,
  normalizeStorePosSettings,
  parseStorePosSettingsUpdate,
  resolveConfiguredPaymentMethod,
  switchPaymentMethod,
  shouldUsePaymentToggle,
} from "./storePosSettings";

test("store POS settings default to hidden locations and all supported payment methods", () => {
  assert.deepEqual(DEFAULT_STORE_POS_SETTINGS, {
    showProductLocation: false,
    paymentMethods: ["Cash", "Bank transfer", "Credit card"],
  });
});

test("store POS settings update requires a boolean and at least one unique supported method", () => {
  assert.deepEqual(parseStorePosSettingsUpdate({
    showProductLocation: true,
    paymentMethods: ["Cash", "Bank transfer"],
  }), {
    showProductLocation: true,
    paymentMethods: ["Cash", "Bank transfer"],
  });
  assert.equal(parseStorePosSettingsUpdate({ showProductLocation: true, paymentMethods: [] }), null);
  assert.equal(parseStorePosSettingsUpdate({ showProductLocation: true, paymentMethods: ["Cash", "Cash"] }), null);
  assert.equal(parseStorePosSettingsUpdate({ showProductLocation: true, paymentMethods: ["Cheque"] }), null);
});

test("persisted store POS settings discard invalid methods and fall back safely", () => {
  assert.deepEqual(normalizeStorePosSettings({
    showProductLocation: true,
    paymentMethods: ["Mobile payment", "Cheque", "Cash", "Cash"],
  }), {
    showProductLocation: true,
    paymentMethods: ["Cash", "Bank transfer"],
  });
  assert.deepEqual(normalizeStorePosSettings({ paymentMethods: [] }), DEFAULT_STORE_POS_SETTINGS);
});

test("Cash and Bank transfer alone use the compact two-method toggle", () => {
  assert.equal(shouldUsePaymentToggle(["Cash", "Bank transfer"]), true);
  assert.equal(shouldUsePaymentToggle(["Bank transfer", "Cash"]), true);
  assert.equal(shouldUsePaymentToggle(["Cash"]), false);
  assert.equal(shouldUsePaymentToggle(["Cash", "Bank transfer", "Credit card"]), false);
});

test("the compact payment toggle switches to the other enabled method", () => {
  assert.equal(switchPaymentMethod("Cash", ["Cash", "Bank transfer"]), "Bank transfer");
  assert.equal(switchPaymentMethod("Bank transfer", ["Cash", "Bank transfer"]), "Cash");
});

test("a disabled or legacy payment selection resolves to an enabled method", () => {
  assert.equal(resolveConfiguredPaymentMethod("Cash", ["Cash", "Bank transfer"]), "Cash");
  assert.equal(resolveConfiguredPaymentMethod("PromptPay", ["Cash", "Bank transfer"]), "Bank transfer");
  assert.equal(resolveConfiguredPaymentMethod("Mobile payment", ["Cash", "Bank transfer"]), "Bank transfer");
  assert.equal(resolveConfiguredPaymentMethod("Credit card", ["Cash", "Bank transfer"]), "Cash");
});

test("legacy Mobile payment API input is accepted and returned as Bank transfer", () => {
  assert.deepEqual(parseStorePosSettingsUpdate({
    showProductLocation: false,
    paymentMethods: ["Cash", "Mobile payment"],
  }), {
    showProductLocation: false,
    paymentMethods: ["Cash", "Bank transfer"],
  });
});
