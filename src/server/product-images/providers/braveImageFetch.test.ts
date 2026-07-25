import assert from "node:assert/strict";
import test from "node:test";
import type { ValidatedProductImage } from "../resolver";
import { ProductImageFetchHttpError } from "../secureFetch";
import {
  BRAVE_IMAGE_INSPECTION_POLICY,
  candidateHasValidatedPreview,
  fetchBraveCandidateImage,
} from "./braveImageFetch";

const VALID_IMAGE: ValidatedProductImage = {
  bytes: new Uint8Array([1]),
  metadata: {
    mimeType: "image/webp",
    width: 100,
    height: 100,
    byteSize: 1,
  },
  sha256: "a".repeat(64),
};

test("accepts useful review thumbnails while still rejecting tracking-pixel dimensions", () => {
  assert.deepEqual(BRAVE_IMAGE_INSPECTION_POLICY, {
    minimumShortSide: 96,
    minimumLongSide: 96,
  });
});

test("retries transient Brave proxy failures and returns the recovered image", async () => {
  let calls = 0;
  const image = await fetchBraveCandidateImage("https://imgs.search.brave.com/example/image.webp", {
    fetchImage: async () => {
      calls += 1;
      if (calls < 3) throw new ProductImageFetchHttpError(502);
      return VALID_IMAGE;
    },
    sleep: async () => {},
  });

  assert.equal(calls, 3);
  assert.equal(image, VALID_IMAGE);
});

test("does not retry permanent Brave proxy failures", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchBraveCandidateImage("https://imgs.search.brave.com/missing/image.webp", {
      fetchImage: async () => {
        calls += 1;
        throw new ProductImageFetchHttpError(404);
      },
      sleep: async () => {},
    }),
    /HTTP 404/,
  );
  assert.equal(calls, 1);
});

test("shows Brave candidates in review only after their preview metadata is validated", () => {
  assert.equal(candidateHasValidatedPreview({
    provider: "BRAVE_IMAGE_SEARCH",
    imageMimeType: null,
    imageWidth: null,
    imageHeight: null,
  }), false);
  assert.equal(candidateHasValidatedPreview({
    provider: "BRAVE_IMAGE_SEARCH",
    imageMimeType: "image/webp",
    imageWidth: 100,
    imageHeight: 100,
  }), true);
  assert.equal(candidateHasValidatedPreview({
    provider: "OPEN_PRODUCTS_FACTS",
    imageMimeType: null,
    imageWidth: null,
    imageHeight: null,
  }), true);
});
