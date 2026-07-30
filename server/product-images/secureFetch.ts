import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  inspectProductImage,
  MAX_PRODUCT_IMAGE_BYTES,
  type ProductImageInspectionPolicy,
  type ProductImageMetadata,
} from "./imageMetadata";

type LookupResult = { address: string; family: number };

export type SecureFetchOptions = {
  lookup?: (hostname: string) => Promise<LookupResult[]>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRedirects?: number;
  inspectionPolicy?: ProductImageInspectionPolicy;
};

class ProductImageFetchHttpError extends Error {
  constructor(readonly status: number) {
    super(`Product image returned HTTP ${status}.`);
  }
}

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inIpv4Range(value: number, start: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (ipv4Number(start) & mask);
}

function parseIpv6(address: string): Uint8Array | null {
  const normalized = address.toLocaleLowerCase("en-US").split("%")[0];
  const [head, tail] = normalized.split("::");
  if (normalized.split("::").length > 2) return null;
  const parseParts = (value: string | undefined): number[] | null => {
    if (!value) return [];
    const output: number[] = [];
    for (const part of value.split(":")) {
      if (part.includes(".")) {
        if (isIP(part) !== 4) return null;
        const octets = part.split(".").map(Number);
        output.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        output.push(Number.parseInt(part, 16));
      }
    }
    return output;
  };
  const left = parseParts(head);
  const right = parseParts(tail);
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((tail === undefined && missing !== 0) || (tail !== undefined && missing < 1)) return null;
  const words = [...left, ...Array(Math.max(0, missing)).fill(0), ...right];
  if (words.length !== 8) return null;
  return Uint8Array.from(words.flatMap((word) => [word >> 8, word & 0xff]));
}

export function assertPublicAddress(address: string): void {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    const blocked = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ] as const;
    if (blocked.some(([start, bits]) => inIpv4Range(value, start, bits))) {
      throw new Error("Product image host resolved to a non-public address.");
    }
    return;
  }

  if (family === 6) {
    const bytes = parseIpv6(address);
    if (!bytes) throw new Error("Product image host returned an invalid address.");
    const allZero = bytes.every((byte) => byte === 0);
    const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
    const uniqueLocal = (bytes[0] & 0xfe) === 0xfc;
    const linkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
    const multicast = bytes[0] === 0xff;
    const documentation = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8;
    const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0)
      && bytes[10] === 0xff && bytes[11] === 0xff;
    if (ipv4Mapped) {
      assertPublicAddress([...bytes.slice(12)].join("."));
      return;
    }
    if (allZero || loopback || uniqueLocal || linkLocal || multicast || documentation) {
      throw new Error("Product image host resolved to a non-public address.");
    }
    return;
  }

  throw new Error("Product image host returned an invalid IP address.");
}

function validateExternalImageUrl(source: string): URL {
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("Product image URL must use HTTPS.");
  if (url.username || url.password) throw new Error("Product image URL contains unsupported authority data.");
  return url;
}

export function parseManualProductImageUrl(source: string): URL | null {
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith("/api/product-images/")) return null;
  if (trimmed.length > 2_048) throw new Error("Product image URL is too long.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Product image URL is invalid.");
  }
  return validateExternalImageUrl(url.toString());
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Product images must not exceed 8 MiB.");
  }
  if (!response.body) throw new Error("Product image response had no body.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PRODUCT_IMAGE_BYTES) throw new Error("Product images must not exceed 8 MiB.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchExternalProductImage(
  source: string,
  options: SecureFetchOptions,
): Promise<{ bytes: Uint8Array; metadata: ProductImageMetadata; sha256: string }> {
  const lookup = options.lookup ?? (async (hostname: string) => dnsLookup(hostname, { all: true }));
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 2;
  let url = validateExternalImageUrl(source);

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const addresses = await lookup(url.hostname);
    if (addresses.length === 0) throw new Error("Product image hostname did not resolve.");
    for (const result of addresses) assertPublicAddress(result.address);

    const response = await fetcher(url, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Product image redirect had no destination.");
      const redirected = new URL(location, url);
      if (redirected.hostname.toLocaleLowerCase("en-US") !== url.hostname.toLocaleLowerCase("en-US")) {
        throw new Error("Cross-host product image redirects are not allowed.");
      }
      const next = validateExternalImageUrl(redirected.toString());
      if (redirect === maxRedirects) throw new Error("Product image exceeded the redirect limit.");
      url = next;
      continue;
    }
    if (!response.ok) throw new ProductImageFetchHttpError(response.status);

    const bytes = await readBoundedBody(response);
    const metadata = inspectProductImage(
      bytes,
      response.headers.get("content-type"),
      options.inspectionPolicy,
    );
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    return { bytes, metadata, sha256 };
  }

  throw new Error("Product image could not be fetched.");
}

export async function fetchValidatedManualProductImage(
  source: string,
  options: SecureFetchOptions = {},
): Promise<{ bytes: Uint8Array; metadata: ProductImageMetadata; sha256: string } | null> {
  const url = parseManualProductImageUrl(source);
  if (!url) return null;
  return fetchExternalProductImage(url.toString(), {
    ...options,
    inspectionPolicy: options.inspectionPolicy ?? {
      minimumShortSide: 96,
      minimumLongSide: 96,
    },
  });
}
