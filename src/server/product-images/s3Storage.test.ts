import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductImageStorageKey,
  buildSignedS3Request,
  loadS3Config,
  productImageExtension,
} from "./s3Storage";

test("requires complete server-only S3 configuration", () => {
  assert.throws(() => loadS3Config({}), /not configured/i);
  assert.throws(() => loadS3Config({
    AWS_S3_REGION: "ap-southeast-1",
    AWS_S3_BUCKET: "pharm-images",
    AWS_S3_ACCESS_KEY_ID: "test",
  }), /not configured/i);
});

test("builds checksum-addressed object keys with safe extensions", () => {
  const hash = "a".repeat(64);
  assert.equal(productImageExtension("image/jpeg"), "jpg");
  assert.equal(productImageExtension("image/png"), "png");
  assert.equal(buildProductImageStorageKey("product/one", hash, "image/webp"), `product-images/product%2Fone/${hash}.webp`);
  assert.throws(() => buildProductImageStorageKey("p1", "not-a-hash", "image/png"));
});

test("creates an AWS Signature Version 4 request with a signed payload", () => {
  const request = buildSignedS3Request({
    method: "PUT",
    key: "product-images/p1/abc.png",
    body: new TextEncoder().encode("example"),
    contentType: "image/png",
    now: new Date("2013-05-24T00:00:00.000Z"),
    config: {
      region: "us-east-1",
      bucket: "examplebucket",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      endpoint: "https://s3.us-east-1.amazonaws.com",
    },
  });

  assert.equal(request.url, "https://s3.us-east-1.amazonaws.com/examplebucket/product-images/p1/abc.png");
  assert.equal(request.headers.get("x-amz-date"), "20130524T000000Z");
  assert.match(request.headers.get("x-amz-content-sha256") ?? "", /^[a-f0-9]{64}$/);
  assert.match(
    request.headers.get("authorization") ?? "",
    /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request,SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date,Signature=[a-f0-9]{64}$/,
  );
  assert.equal(request.headers.has("x-amz-acl"), false);
});
