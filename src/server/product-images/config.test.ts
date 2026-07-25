import assert from "node:assert/strict";
import test from "node:test";
import { openProductsFactsImageResolutionIsEnabled } from "./config";

test("Open Products Facts image discovery is disabled by default", () => {
  assert.equal(openProductsFactsImageResolutionIsEnabled({}), false);
  assert.equal(openProductsFactsImageResolutionIsEnabled({
    OPEN_PRODUCTS_FACTS_IMAGE_RESOLUTION_ENABLED: "false",
  }), false);
});

test("Open Products Facts image discovery requires an explicit server opt-in", () => {
  assert.equal(openProductsFactsImageResolutionIsEnabled({
    OPEN_PRODUCTS_FACTS_IMAGE_RESOLUTION_ENABLED: "true",
  }), true);
  assert.equal(openProductsFactsImageResolutionIsEnabled({
    OPEN_PRODUCTS_FACTS_IMAGE_RESOLUTION_ENABLED: "TRUE",
  }), false);
});
