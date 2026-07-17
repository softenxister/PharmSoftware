import assert from "node:assert/strict";
import test from "node:test";
import { shouldCloseDropdown } from "./dropdownInteraction";

test("dropdown stays open while its container ref is unavailable", () => {
  assert.equal(shouldCloseDropdown(null, {} as Node), false);
});

test("dropdown stays open for an interaction inside its trigger or panel", () => {
  const insideTarget = {} as Node;
  const container = {
    contains: (target: Node) => target === insideTarget,
  } as HTMLElement;

  assert.equal(shouldCloseDropdown(container, insideTarget), false);
});

test("dropdown closes for an interaction outside its trigger and panel", () => {
  const insideTarget = {} as Node;
  const outsideTarget = {} as Node;
  const container = {
    contains: (target: Node) => target === insideTarget,
  } as HTMLElement;

  assert.equal(shouldCloseDropdown(container, outsideTarget), true);
});
