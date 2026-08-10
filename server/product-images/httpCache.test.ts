import assert from "node:assert/strict";
import test from "node:test";
import {
  isProductImageNotModified,
  productImageResponseHeaders,
} from "./httpCache";

const sha256 = "a".repeat(64);
const asset = {
  byteSize: 123_456,
  mimeType: "image/webp",
  sha256,
};

test("content-addressed product images are immutable in the private browser cache", () => {
  const headers = productImageResponseHeaders(asset, sha256);

  assert.equal(headers.get("cache-control"), "private, max-age=31536000, immutable");
  assert.equal(headers.get("content-length"), "123456");
  assert.equal(headers.get("content-type"), "image/webp");
  assert.equal(headers.get("etag"), `"${sha256}"`);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
});

test("mutable product image URLs retain the short cache policy", () => {
  assert.equal(
    productImageResponseHeaders(asset, null).get("cache-control"),
    "private, max-age=86400",
  );
  assert.equal(
    productImageResponseHeaders(asset, "stale-version").get("cache-control"),
    "private, max-age=86400",
  );
});

test("matching browser validators avoid downloading the stored image again", () => {
  assert.equal(isProductImageNotModified(`"${sha256}"`, sha256), true);
  assert.equal(isProductImageNotModified(`W/"${sha256}"`, sha256), true);
  assert.equal(isProductImageNotModified(`"old", W/"${sha256}"`, sha256), true);
  assert.equal(isProductImageNotModified("*", sha256), true);
  assert.equal(isProductImageNotModified("\"old\"", sha256), false);
  assert.equal(isProductImageNotModified(null, sha256), false);
});
