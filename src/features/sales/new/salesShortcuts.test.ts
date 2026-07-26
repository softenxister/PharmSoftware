import assert from "node:assert/strict";
import test from "node:test";
import { resolveSaleShortcut, subscribeSaleShortcuts } from "./salesShortcuts";

const allMethods = ["Cash", "Bank transfer", "Credit card"] as const;

test("sale shortcuts provide keyboard-first save and payment access", () => {
  assert.deepEqual(resolveSaleShortcut({ key: "s", ctrlKey: true }, allMethods), { type: "save-pending" });
  assert.deepEqual(resolveSaleShortcut({ key: "Enter", ctrlKey: true }, allMethods), { type: "open-payment" });
  assert.deepEqual(resolveSaleShortcut({ key: "Enter", metaKey: true }, allMethods), { type: "open-payment" });
});

test("function keys map to fixed payment methods without modifiers", () => {
  assert.deepEqual(resolveSaleShortcut({ key: "F1" }, allMethods), { type: "select-payment", method: "Cash" });
  assert.deepEqual(resolveSaleShortcut({ key: "F2" }, allMethods), { type: "select-payment", method: "Bank transfer" });
  assert.deepEqual(resolveSaleShortcut({ key: "F3" }, allMethods), { type: "select-payment", method: "Credit card" });
});

test("payment shortcuts do nothing when that method is disabled", () => {
  assert.equal(resolveSaleShortcut({ key: "F1" }, ["Bank transfer"]), null);
  assert.deepEqual(resolveSaleShortcut({ key: "F2" }, ["Bank transfer"]), {
    type: "select-payment",
    method: "Bank transfer",
  });
  assert.equal(resolveSaleShortcut({ key: "F3" }, ["Bank transfer"]), null);
});

test("global shortcut subscription receives F2 without dropdown focus", () => {
  const target = new EventTarget();
  const actions: unknown[] = [];
  const unsubscribe = subscribeSaleShortcuts(target, (event) => {
    const action = resolveSaleShortcut(event, allMethods);
    if (action) actions.push(action);
  });
  const f2Event = new Event("keydown");
  Object.defineProperty(f2Event, "key", { value: "F2" });

  target.dispatchEvent(f2Event);

  assert.deepEqual(actions, [{ type: "select-payment", method: "Bank transfer" }]);
  unsubscribe();
  target.dispatchEvent(f2Event);
  assert.equal(actions.length, 1);
});

test("unmodified letters and unrelated keys are ignored", () => {
  assert.equal(resolveSaleShortcut({ key: "s" }, allMethods), null);
  assert.equal(resolveSaleShortcut({ key: "F4" }, allMethods), null);
});
