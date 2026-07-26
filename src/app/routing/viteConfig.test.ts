import assert from "node:assert/strict";
import test from "node:test";
import viteConfig from "../../../vite.config";

test("Vite pre-bundles dependencies first discovered by the lazy Settings route", () => {
  assert.ok(
    viteConfig.optimizeDeps?.include?.includes("@radix-ui/react-switch"),
    "Settings must not invalidate Vite's dependency cache when first opened",
  );
});
