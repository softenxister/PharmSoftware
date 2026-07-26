import assert from "node:assert/strict";
import test from "node:test";
import { shouldCloseProfileMenu } from "./profileMenu";

test("profile menu stays open when its container ref is temporarily unavailable", () => {
  assert.equal(shouldCloseProfileMenu(null, {} as Node), false);
});

test("profile menu closes only for a pointer target outside its container", () => {
  const insideTarget = {} as Node;
  const outsideTarget = {} as Node;
  const container = {
    contains: (target: Node) => target === insideTarget,
  } as HTMLElement;

  assert.equal(shouldCloseProfileMenu(container, insideTarget), false);
  assert.equal(shouldCloseProfileMenu(container, outsideTarget), true);
});
