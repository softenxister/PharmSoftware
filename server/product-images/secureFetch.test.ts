import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicAddress,
  fetchValidatedManualProductImage,
  parseManualProductImageUrl,
} from "./secureFetch";

test("manual image URLs accept public HTTPS sources and reject unsafe URL forms", () => {
  assert.equal(
    parseManualProductImageUrl(" https://cdn.example.com/products/item.png ")?.toString(),
    "https://cdn.example.com/products/item.png",
  );
  assert.equal(parseManualProductImageUrl("/api/product-images/product-1?v=abc"), null);
  assert.equal(parseManualProductImageUrl("   "), null);
  assert.throws(() => parseManualProductImageUrl("http://cdn.example.com/item.png"), /HTTPS/i);
  assert.throws(() => parseManualProductImageUrl("https://user:password@cdn.example.com/item.png"), /authority/i);
  assert.equal(
    parseManualProductImageUrl("https://cdn.example.com:8443/item.png")?.toString(),
    "https://cdn.example.com:8443/item.png",
  );
});

test("rejects private, loopback, link-local, multicast, and reserved addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "224.0.0.1",
    "192.0.2.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ]) {
    assert.throws(() => assertPublicAddress(address), address);
  }
  assert.doesNotThrow(() => assertPublicAddress("8.8.8.8"));
  assert.doesNotThrow(() => assertPublicAddress("2606:4700:4700::1111"));
});

test("manual image fetch validates DNS, streams bytes, and rejects cross-host redirects", async () => {
  const validPng = new Uint8Array(24);
  validPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  validPng.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(validPng.buffer).setUint32(16, 900);
  new DataView(validPng.buffer).setUint32(20, 700);

  const fetched = await fetchValidatedManualProductImage(
    "https://cdn.example.com/example.png",
    {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
      fetch: async () => new Response(validPng, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    },
  );
  assert.equal(fetched.metadata.mimeType, "image/png");
  assert.equal(fetched.bytes.byteLength, 24);

  await assert.rejects(() => fetchValidatedManualProductImage(
    "https://cdn.example.com/example.png",
    {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
      fetch: async () => new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/image.png" },
      }),
    },
  ), /redirect/i);
});

test("manual image fetch enforces minimum dimensions and rejects private addresses", async () => {
  const validPng = new Uint8Array(24);
  validPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  validPng.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(validPng.buffer).setUint32(16, 500);
  new DataView(validPng.buffer).setUint32(20, 500);

  const fetched = await fetchValidatedManualProductImage(
    "https://cdn.example.com/products/item.png",
    {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
      fetch: async () => new Response(validPng, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    },
  );
  assert.equal(fetched?.metadata.mimeType, "image/png");
  assert.equal(fetched?.metadata.width, 500);

  await assert.rejects(() => fetchValidatedManualProductImage(
    "https://internal.example/item.png",
    {
      lookup: async () => [{ address: "10.0.0.5", family: 4 }],
      fetch: async () => new Response(validPng),
    },
  ), /non-public/i);
});
