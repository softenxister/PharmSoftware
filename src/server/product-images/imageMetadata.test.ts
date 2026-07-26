import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductImage } from "./imageMetadata";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

test("detects image type and dimensions from bytes rather than response headers", () => {
  assert.deepEqual(inspectProductImage(png(900, 700), "image/jpeg"), {
    mimeType: "image/png",
    width: 900,
    height: 700,
    byteSize: 24,
  });
});

test("rejects HTML, SVG, tiny images, and unsupported signatures", () => {
  assert.throws(() => inspectProductImage(new TextEncoder().encode("<html>not an image</html>"), "image/png"));
  assert.throws(() => inspectProductImage(new TextEncoder().encode("<svg></svg>"), "image/svg+xml"));
  assert.throws(() => inspectProductImage(png(200, 200), "image/png"), /resolution/i);
  assert.throws(() => inspectProductImage(new Uint8Array([1, 2, 3, 4]), "image/png"), /format/i);
});

test("accepts smaller external images only with an explicit inspection policy", () => {
  assert.throws(() => inspectProductImage(png(500, 500), "image/png"), /resolution/i);
  assert.deepEqual(
    inspectProductImage(png(500, 500), "image/png", {
      minimumShortSide: 300,
      minimumLongSide: 400,
    }),
    {
      mimeType: "image/png",
      width: 500,
      height: 500,
      byteSize: 24,
    },
  );
  assert.throws(
    () => inspectProductImage(png(200, 200), "image/png", {
      minimumShortSide: 300,
      minimumLongSide: 400,
    }),
    /resolution/i,
  );
});

test("rejects images larger than the configured byte limit", () => {
  assert.throws(
    () => inspectProductImage(new Uint8Array(9 * 1024 * 1024), "image/png"),
    /8 MiB/i,
  );
});
