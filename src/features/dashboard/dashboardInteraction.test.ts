import assert from "node:assert/strict";
import test from "node:test";
import { scrollTimelineWithWheel } from "./dashboardInteraction";

test("vertical mouse wheel movement scrolls a wide timeline horizontally", () => {
  const scroller = { scrollLeft: 100, scrollWidth: 1200, clientWidth: 600 };

  assert.equal(scrollTimelineWithWheel(scroller, { deltaX: 0, deltaY: 80 }), true);
  assert.equal(scroller.scrollLeft, 180);
});

test("timeline wheel yields to page scrolling at either horizontal boundary", () => {
  const left = { scrollLeft: 0, scrollWidth: 1200, clientWidth: 600 };
  const right = { scrollLeft: 600, scrollWidth: 1200, clientWidth: 600 };

  assert.equal(scrollTimelineWithWheel(left, { deltaX: 0, deltaY: -60 }), false);
  assert.equal(scrollTimelineWithWheel(right, { deltaX: 0, deltaY: 60 }), false);
});

test("trackpad horizontal movement takes precedence over vertical noise", () => {
  const scroller = { scrollLeft: 100, scrollWidth: 1200, clientWidth: 600 };

  assert.equal(scrollTimelineWithWheel(scroller, { deltaX: 45, deltaY: 10 }), true);
  assert.equal(scroller.scrollLeft, 145);
});
