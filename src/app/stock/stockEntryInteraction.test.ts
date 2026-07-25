import assert from "node:assert/strict";
import test from "node:test";
import {
  isStockSaveShortcut,
  selectStockIdentityText,
} from "./stockEntryInteraction";

test("identity fields select all text when clicked in edit mode", () => {
  let selectCount = 0;
  const input = {
    select() {
      selectCount += 1;
    },
  };

  selectStockIdentityText("edit", input);

  assert.equal(selectCount, 1);
});

test("identity fields keep normal click behavior in create mode", () => {
  let selectCount = 0;
  const input = {
    select() {
      selectCount += 1;
    },
  };

  selectStockIdentityText("create", input);

  assert.equal(selectCount, 0);
});

test("Ctrl+S and Cmd+S save only the edit form", () => {
  assert.equal(isStockSaveShortcut("edit", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }), true);
  assert.equal(isStockSaveShortcut("edit", {
    key: "S",
    ctrlKey: false,
    metaKey: true,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }), true);
  assert.equal(isStockSaveShortcut("create", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }), false);
});

test("modified or repeated save shortcuts do not submit", () => {
  assert.equal(isStockSaveShortcut("edit", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: true,
    repeat: false,
  }), false);
  assert.equal(isStockSaveShortcut("edit", {
    key: "s",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: true,
  }), false);
});
