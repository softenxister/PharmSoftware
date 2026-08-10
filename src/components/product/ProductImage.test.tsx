import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductImage } from "./ProductImage";

test("non-critical product images defer network and decoding work", () => {
  const markup = renderToStaticMarkup(
    <ProductImage src="/api/product-images/product-1?v=abc" alt="Paracetamol" width={52} height={52} />,
  );

  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /decoding="async"/);
  assert.match(markup, /fetchPriority="low"/);
  assert.match(markup, /width="52"/);
  assert.match(markup, /height="52"/);
});

test("critical product images start immediately with high fetch priority", () => {
  const markup = renderToStaticMarkup(
    <ProductImage priority src="/api/product-images/product-1?v=abc" alt="Paracetamol" width={86} height={86} />,
  );

  assert.match(markup, /loading="eager"/);
  assert.match(markup, /fetchPriority="high"/);
  assert.match(markup, /decoding="async"/);
});
