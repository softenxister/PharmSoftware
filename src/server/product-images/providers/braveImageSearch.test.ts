import assert from "node:assert/strict";
import test from "node:test";
import {
  BRAVE_IMAGE_SEARCH_PROVIDER,
  BRAVE_IMAGE_SOURCE_RIGHTS_NOTICE,
  buildBraveImageSearchUrl,
  createBraveImageSearchClient,
  parseBraveImageSearchResponse,
} from "./braveImageSearch";

test("builds one strict image result query from only barcode and item name", () => {
  const url = new URL(buildBraveImageSearchUrl("  8850001234567 ", "  Para   500 mg "));
  assert.equal(url.origin + url.pathname, "https://api.search.brave.com/res/v1/images/search");
  assert.equal(url.searchParams.get("q"), "8850001234567 Para 500 mg");
  assert.equal(url.searchParams.get("count"), "1");
  assert.equal(url.searchParams.get("safesearch"), "strict");
  assert.equal(url.searchParams.get("spellcheck"), "false");
});

test("uses only the first Brave-hosted thumbnail and preserves the source page", () => {
  const candidate = parseBraveImageSearchResponse({
    results: [
      {
        title: "Para 500 mg box",
        url: "https://example-pharmacy.test/products/para",
        thumbnail: { src: "https://imgs.search.brave.com/abc123/rs:fit:500:0:0/g:ce/aHR0cHM/image.jpg" },
        properties: { url: "https://untrusted-origin.test/full.jpg" },
      },
      {
        title: "Second result must not be used",
        url: "https://other.test/product",
        thumbnail: { src: "https://imgs.search.brave.com/second/image.jpg" },
      },
    ],
  }, "8850001234567", "Para 500 mg");

  assert.equal(candidate?.provider, BRAVE_IMAGE_SEARCH_PROVIDER);
  assert.equal(candidate?.sourceImageUrl, "https://imgs.search.brave.com/abc123/rs:fit:500:0:0/g:ce/aHR0cHM/image.jpg");
  assert.equal(candidate?.sourcePageUrl, "https://example-pharmacy.test/products/para");
  assert.equal(candidate?.sourceIdentifierType, "BARCODE_QUERY");
  assert.equal(candidate?.sourceIdentifierValue, "8850001234567");
  assert.equal(candidate?.sourceLicence, BRAVE_IMAGE_SOURCE_RIGHTS_NOTICE);
});

test("rejects missing, non-HTTPS, and non-Brave proxy image results", () => {
  assert.equal(parseBraveImageSearchResponse({}, "123", "Item"), null);
  assert.equal(parseBraveImageSearchResponse({
    results: [{
      title: "Unsafe",
      url: "https://source.test/item",
      thumbnail: { src: "https://attacker.test/image.jpg" },
    }],
  }, "123", "Item"), null);
  assert.equal(parseBraveImageSearchResponse({
    results: [{
      title: "Unsafe source",
      url: "http://source.test/item",
      thumbnail: { src: "https://imgs.search.brave.com/image.jpg" },
    }],
  }, "123", "Item"), null);
});

test("sends the API key only in the server request header and makes one fetch", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createBraveImageSearchClient({
    apiKey: "server-secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        results: [{
          title: "Para",
          url: "https://source.test/para",
          thumbnail: { src: "https://imgs.search.brave.com/para/image.jpg" },
        }],
      }, {
        headers: {
          "x-ratelimit-remaining": "998",
          "x-ratelimit-reset": "1",
        },
      });
    },
  });

  const result = await client.search("8850001234567", "Para");
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].init?.headers).get("x-subscription-token"), "server-secret");
  assert.doesNotMatch(calls[0].url, /server-secret/);
  assert.equal(result.candidate?.sourceProductName, "Para");
  assert.deepEqual(result.rateLimit, { remaining: 998, resetSeconds: 1 });
});

test("does not retry an upstream error or expose its response body", async () => {
  let calls = 0;
  const client = createBraveImageSearchClient({
    apiKey: "server-secret",
    fetch: async () => {
      calls += 1;
      return new Response("secret upstream diagnostic", { status: 429 });
    },
  });

  await assert.rejects(
    () => client.search("8850001234567", "Para"),
    /HTTP 429/,
  );
  assert.equal(calls, 1);
});
