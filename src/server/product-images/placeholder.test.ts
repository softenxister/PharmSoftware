import assert from "node:assert/strict";
import test from "node:test";
import {
  createUnresolvedProductSvg,
  productImageUrl,
  resolvePlaceholderBrand,
} from "./placeholder";

test("uses Invalid for missing, blank, or unspecified brands", () => {
  assert.equal(resolvePlaceholderBrand(null), "Invalid");
  assert.equal(resolvePlaceholderBrand("  "), "Invalid");
  assert.equal(resolvePlaceholderBrand("Unspecified"), "Invalid");
  assert.equal(resolvePlaceholderBrand(" UNSPECIFIED "), "Invalid");
});

test("keeps a real brand and caps its displayed length", () => {
  assert.equal(resolvePlaceholderBrand("  Tylenol  "), "Tylenol");
  assert.equal(resolvePlaceholderBrand("A".repeat(100)).length, 48);
});

test("renders the approved white and dark-green informative placeholder", () => {
  const svg = createUnresolvedProductSvg("Tylenol");

  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /fill="#14532d"/);
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, />Tylenol</);
  assert.match(svg, />No verified image</);
  assert.doesNotMatch(svg, /<script|<image|\shref=/i);
});

test("escapes malicious brand text and emits no remote content", () => {
  const svg = createUnresolvedProductSvg(`<script>alert("x")</script> & Co`);

  assert.doesNotMatch(svg, /<script>/i);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /&amp; Co/);
});

test("builds stable internal product image URLs", () => {
  assert.equal(
    productImageUrl("product/with spaces"),
    "/api/product-images/product%2Fwith%20spaces",
  );
});
