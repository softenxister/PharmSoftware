import { createHash, createHmac } from "node:crypto";

export type S3Config = {
  provider: "amazon-s3" | "backblaze-b2";
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
};

type BuildSignedRequestInput = {
  method: "DELETE" | "GET" | "PUT" | "HEAD";
  key: string;
  body?: Uint8Array;
  contentType?: string;
  query?: Record<string, string>;
  now?: Date;
  config: S3Config;
};

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error("Private product-image storage is not configured.");
  return value;
}

export function loadS3Config(
  environment: Record<string, string | undefined> = process.env,
): S3Config {
  const backblazeNames = [
    "BACKBLAZE_B2_REGION",
    "BACKBLAZE_B2_BUCKET",
    "BACKBLAZE_B2_KEY_ID",
    "BACKBLAZE_B2_APPLICATION_KEY",
  ] as const;
  const hasBackblazeConfiguration = backblazeNames.some((name) => environment[name]?.trim());
  if (hasBackblazeConfiguration) {
    const region = required(environment, "BACKBLAZE_B2_REGION");
    const bucket = required(environment, "BACKBLAZE_B2_BUCKET");
    const accessKeyId = required(environment, "BACKBLAZE_B2_KEY_ID");
    const secretAccessKey = required(environment, "BACKBLAZE_B2_APPLICATION_KEY");

    if (!/^[a-z]{2}-[a-z]+-\d{3}$/.test(region)) {
      throw new Error("Backblaze B2 region is invalid.");
    }
    if (!/^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
      throw new Error("Backblaze B2 bucket name is invalid.");
    }

    return {
      provider: "backblaze-b2",
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      endpoint: `https://s3.${region}.backblazeb2.com`,
    };
  }

  const region = required(environment, "AWS_S3_REGION");
  const bucket = required(environment, "AWS_S3_BUCKET");
  const accessKeyId = required(environment, "AWS_S3_ACCESS_KEY_ID");
  const secretAccessKey = required(environment, "AWS_S3_SECRET_ACCESS_KEY");
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)) throw new Error("Amazon S3 region is invalid.");
  if (!/^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("Amazon S3 bucket name is invalid.");
  }

  const configuredEndpoint = environment.AWS_S3_ENDPOINT?.trim();
  const endpoint = configuredEndpoint || `https://s3.${region}.amazonaws.com`;
  const endpointUrl = new URL(endpoint);
  const localTestEndpoint = endpointUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "::1"].includes(endpointUrl.hostname);
  if (endpointUrl.protocol !== "https:" && !localTestEndpoint) {
    throw new Error("Amazon S3 endpoint must use HTTPS.");
  }
  if (endpointUrl.username || endpointUrl.password || endpointUrl.search || endpointUrl.hash) {
    throw new Error("Amazon S3 endpoint is invalid.");
  }

  return {
    provider: "amazon-s3",
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpointUrl.toString().replace(/\/$/, ""),
  };
}

export function productImageExtension(mimeType: string): string {
  const extension = MIME_EXTENSIONS[mimeType as keyof typeof MIME_EXTENSIONS];
  if (!extension) throw new Error("Unsupported product image MIME type.");
  return extension;
}

export function buildProductImageStorageKey(productId: string, sha256: string, mimeType: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Product image checksum is invalid.");
  return `${buildProductImageStoragePrefix(productId)}${sha256}.${productImageExtension(mimeType)}`;
}

export function buildProductImageStoragePrefix(productId: string): string {
  if (!productId.trim()) throw new Error("Product id is required for image storage.");
  return `product-images/${encodeURIComponent(productId)}/`;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function awsTimestamp(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQuery(query: Record<string, string> | undefined): string {
  return Object.entries(query ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function requestUrl(config: S3Config, key: string, query: Record<string, string> | undefined): URL {
  const endpoint = new URL(config.endpoint);
  const basePath = endpoint.pathname.replace(/\/$/, "");
  endpoint.pathname = `${basePath}/${encodeURIComponent(config.bucket)}/${key}`;
  endpoint.search = canonicalQuery(query);
  return endpoint;
}

// Implements the signed, single-chunk payload flow documented by Amazon S3:
// https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html
export function buildSignedS3Request(input: BuildSignedRequestInput): {
  url: string;
  headers: Headers;
  body: Uint8Array;
} {
  const body = input.body ?? new Uint8Array();
  const now = input.now ?? new Date();
  const timestamp = awsTimestamp(now);
  const date = timestamp.slice(0, 8);
  const payloadHash = sha256(body);
  const url = requestUrl(input.config, input.key, input.query);
  const headerValues: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  };
  if (input.contentType) headerValues["content-type"] = input.contentType;

  const signedHeaders = Object.keys(headerValues).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headerValues[name].trim()}\n`).join("");
  const canonicalRequest = [
    input.method,
    url.pathname,
    canonicalQuery(input.query),
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");
  const scope = `${date}/${input.config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${input.config.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, input.config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const headers = new Headers(headerValues);
  headers.set(
    "authorization",
    `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${scope},SignedHeaders=${signedHeaders.join(";")},Signature=${signature}`,
  );
  return { url: url.toString(), headers, body };
}

async function checkedResponse(response: Response, operation: string): Promise<Response> {
  if (!response.ok) throw new Error(`Amazon S3 ${operation} failed with HTTP ${response.status}.`);
  return response;
}

function decodedXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function xmlValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  for (const match of xml.matchAll(pattern)) values.push(decodedXmlText(match[1]));
  return values;
}

export type StoredObjectVersion = {
  key: string;
  versionId: string;
  isLatest: boolean;
  isDeleteMarker: boolean;
};

function storedObjectVersions(xml: string): StoredObjectVersion[] {
  const versions: StoredObjectVersion[] = [];
  const pattern = /<(Version|DeleteMarker)>([\s\S]*?)<\/\1>/gi;
  for (const match of xml.matchAll(pattern)) {
    const key = xmlValues(match[2], "Key")[0];
    const versionId = xmlValues(match[2], "VersionId")[0];
    if (!key || !versionId) continue;
    versions.push({
      key,
      versionId,
      isLatest: xmlValues(match[2], "IsLatest")[0]?.trim().toLowerCase() === "true",
      isDeleteMarker: match[1].toLowerCase() === "deletemarker",
    });
  }
  return versions;
}

function validateProductImagePrefix(prefix: string): void {
  if (!prefix.startsWith("product-images/") || (prefix !== "product-images/" && !prefix.endsWith("/"))) {
    throw new Error("Product image storage prefix is invalid.");
  }
}

export function createS3ProductImageStorage(options: {
  config?: S3Config;
  fetch?: typeof fetch;
} = {}) {
  const config = options.config ?? loadS3Config();
  const fetcher = options.fetch ?? fetch;

  return {
    async verifyPrivateBucket(): Promise<void> {
      if (config.provider === "backblaze-b2") {
        const bucketAcl = buildSignedS3Request({
          method: "GET",
          key: "",
          query: { acl: "" },
          config,
        });
        const bucketAclResponse = await checkedResponse(
          await fetcher(bucketAcl.url, { headers: bucketAcl.headers }),
          "bucket ACL check",
        );
        const bucketAclXml = await bucketAclResponse.text();
        const hasOwnerControl = /<Permission>\s*FULL_CONTROL\s*<\/Permission>/i.test(bucketAclXml);
        const hasPublicGrant = /<URI>[^<]*(?:AllUsers|AuthenticatedUsers)[^<]*<\/URI>/i.test(bucketAclXml);
        if (!hasOwnerControl || hasPublicGrant) {
          throw new Error("Backblaze B2 product-image bucket must be private.");
        }
        return;
      }

      const head = buildSignedS3Request({ method: "HEAD", key: "", config });
      await checkedResponse(await fetcher(head.url, { method: "HEAD", headers: head.headers }), "bucket check");

      const publicAccess = buildSignedS3Request({
        method: "GET",
        key: "",
        query: { publicAccessBlock: "" },
        config,
      });
      const publicAccessResponse = await checkedResponse(
        await fetcher(publicAccess.url, { headers: publicAccess.headers }),
        "public-access check",
      );
      const publicAccessXml = await publicAccessResponse.text();
      for (const setting of ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"]) {
        if (!new RegExp(`<${setting}>true</${setting}>`, "i").test(publicAccessXml)) {
          throw new Error("Amazon S3 Block Public Access must be fully enabled.");
        }
      }

      const ownership = buildSignedS3Request({
        method: "GET",
        key: "",
        query: { ownershipControls: "" },
        config,
      });
      const ownershipResponse = await checkedResponse(
        await fetcher(ownership.url, { headers: ownership.headers }),
        "object-ownership check",
      );
      const ownershipXml = await ownershipResponse.text();
      if (!/<ObjectOwnership>BucketOwnerEnforced<\/ObjectOwnership>/i.test(ownershipXml)) {
        throw new Error("Amazon S3 Object Ownership must be Bucket owner enforced.");
      }
    },

    async putObject(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
      const request = buildSignedS3Request({
        method: "PUT",
        key,
        body: bytes,
        contentType: mimeType,
        config,
      });
      await checkedResponse(await fetcher(request.url, {
        method: "PUT",
        headers: request.headers,
        body: Buffer.from(request.body),
      }), "upload");
    },

    async getObject(key: string): Promise<Response> {
      const request = buildSignedS3Request({ method: "GET", key, config });
      return checkedResponse(await fetcher(request.url, {
        headers: request.headers,
      }), "read");
    },

    async listObjectVersions(prefix = "product-images/"): Promise<StoredObjectVersion[]> {
      validateProductImagePrefix(prefix);
      if (config.provider !== "backblaze-b2") {
        throw new Error("Versioned product image cleanup requires Backblaze B2.");
      }
      const versions: StoredObjectVersion[] = [];
      let keyMarker: string | undefined;
      let versionIdMarker: string | undefined;
      do {
        const query: Record<string, string> = { versions: "", prefix };
        if (keyMarker) query["key-marker"] = keyMarker;
        if (versionIdMarker) query["version-id-marker"] = versionIdMarker;
        const list = buildSignedS3Request({ method: "GET", key: "", query, config });
        const response = await checkedResponse(
          await fetcher(list.url, { headers: list.headers }),
          "product image version listing",
        );
        const xml = await response.text();
        versions.push(...storedObjectVersions(xml).filter((version) => version.key.startsWith(prefix)));
        if (!/<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)) break;
        keyMarker = xmlValues(xml, "NextKeyMarker")[0];
        versionIdMarker = xmlValues(xml, "NextVersionIdMarker")[0];
        if (!keyMarker) {
          throw new Error("Backblaze B2 product image listing did not provide a key marker.");
        }
      } while (keyMarker);
      return versions;
    },

    async deleteObjectVersion(version: Pick<StoredObjectVersion, "key" | "versionId">): Promise<void> {
      if (!version.key.startsWith("product-images/") || !version.versionId) {
        throw new Error("Product image object version is invalid.");
      }
      if (config.provider !== "backblaze-b2") {
        throw new Error("Versioned product image cleanup requires Backblaze B2.");
      }
      const request = buildSignedS3Request({
        method: "DELETE",
        key: version.key,
        query: { versionId: version.versionId },
        config,
      });
      await checkedResponse(await fetcher(request.url, {
        method: "DELETE",
        headers: request.headers,
      }), "version delete");
    },

    async deleteOtherObjects(prefix: string, keepKey: string): Promise<void> {
      validateProductImagePrefix(prefix);
      if (!keepKey.startsWith(prefix)) {
        throw new Error("Current product image key is outside its product prefix.");
      }

      if (config.provider === "backblaze-b2") {
        const storedVersions = await this.listObjectVersions(prefix);

        const currentVersions = storedVersions.filter((version) => (
          version.key === keepKey
          && version.isLatest
          && !version.isDeleteMarker
        ));
        if (currentVersions.length !== 1) {
          throw new Error("Backblaze B2 did not return exactly one current product image.");
        }
        for (const version of storedVersions) {
          if (version === currentVersions[0]) continue;
          await this.deleteObjectVersion(version);
        }
        return;
      }

      const storedKeys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const query: Record<string, string> = {
          "list-type": "2",
          prefix,
        };
        if (continuationToken) query["continuation-token"] = continuationToken;
        const list = buildSignedS3Request({ method: "GET", key: "", query, config });
        const response = await checkedResponse(
          await fetcher(list.url, { headers: list.headers }),
          "product image listing",
        );
        const xml = await response.text();
        storedKeys.push(...xmlValues(xml, "Key").filter((key) => key.startsWith(prefix)));
        if (!/<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)) break;
        continuationToken = xmlValues(xml, "NextContinuationToken")[0];
        if (!continuationToken) {
          throw new Error("Amazon S3 product image listing did not provide a continuation token.");
        }
      } while (continuationToken);

      for (const key of storedKeys) {
        if (key === keepKey) continue;
        const request = buildSignedS3Request({ method: "DELETE", key, config });
        await checkedResponse(await fetcher(request.url, {
          method: "DELETE",
          headers: request.headers,
        }), "delete");
      }
    },
  };
}
