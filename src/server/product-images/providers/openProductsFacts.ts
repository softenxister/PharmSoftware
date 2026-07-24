import { normalizeGtin } from "../identity";
import type { ProductImageProvider, ProductImageProviderCandidate } from "./types";

const API_HOST = "world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "brands",
  "manufacturer",
  "quantity",
  "countries_codes",
  "image_front_url",
].join(",");

export const OPEN_PRODUCTS_FACTS_IMAGE_HOSTS = [
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
  "images.openbeautyfacts.org",
  "static.openbeautyfacts.org",
  "images.openproductsfacts.org",
  "static.openproductsfacts.org",
] as const;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

function marketFromCountries(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const countries = value.filter((entry): entry is string => typeof entry === "string");
  if (countries.some((entry) => entry.toLocaleLowerCase("en-US") === "en:thailand")) return "TH";
  if (countries.some((entry) => entry.toLocaleLowerCase("en-US") === "en:united-states")) return "US";
  return null;
}

function packCountFromQuantity(value: unknown): string | null {
  const quantity = optionalString(value);
  if (!quantity) return null;
  const match = quantity.match(/\b(\d{1,5})\s*(?:tablets?|tabs?|capsules?|caps?|sachets?|pieces?|pcs?|units?)\b/i);
  return match?.[1] ?? null;
}

function safeImageUrl(value: unknown): string | null {
  const source = optionalString(value);
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !OPEN_PRODUCTS_FACTS_IMAGE_HOSTS.includes(
      url.hostname.toLocaleLowerCase("en-US") as typeof OPEN_PRODUCTS_FACTS_IMAGE_HOSTS[number],
    )) return null;

    // The API's image_front_url commonly points to a 400 px display derivative.
    // Open Products Facts uses the same selected-image path with `.full` for the
    // original-resolution derivative.
    url.pathname = url.pathname.replace(
      /\.(?:100|200|400|800)\.(jpe?g|png|webp|avif)$/i,
      ".full.$1",
    );
    return url.toString();
  } catch {
    return null;
  }
}

export function buildOpenProductsFactsUrl(gtin14: string): string {
  const url = new URL(`https://${API_HOST}/api/v3/product/${encodeURIComponent(gtin14)}`);
  url.searchParams.set("product_type", "all");
  url.searchParams.set("fields", FIELDS);
  return url.toString();
}

export function parseOpenProductsFactsResponse(
  payload: unknown,
  requestedGtin14: string,
): ProductImageProviderCandidate | null {
  const root = record(payload);
  const product = record(root?.product);
  const sourceCode = optionalString(product?.code);
  const sourceImageUrl = safeImageUrl(product?.image_front_url);
  const requested = normalizeGtin(requestedGtin14);
  const source = normalizeGtin(sourceCode);
  if (!product || !sourceCode || !sourceImageUrl || !requested || source !== requested) return null;

  return {
    provider: "OPEN_PRODUCTS_FACTS",
    sourcePageUrl: `https://${API_HOST}/product/${encodeURIComponent(sourceCode)}`,
    sourceImageUrl,
    sourceLicence: "CC BY-SA 3.0",
    matchMethod: "EXACT_GTIN",
    sourceIdentifierType: "GTIN",
    sourceIdentifierValue: requested,
    sourceProductName: optionalString(product.product_name),
    sourceBrand: optionalString(product.brands),
    sourceManufacturer: optionalString(product.manufacturer),
    sourceMarket: marketFromCountries(product.countries_codes),
    sourcePackCount: packCountFromQuantity(product.quantity),
  };
}

export function createOpenProductsFactsProvider(options: {
  fetch?: typeof fetch;
  userAgent?: string;
  minIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
} = {}): ProductImageProvider {
  const fetcher = options.fetch ?? fetch;
  const userAgent = options.userAgent ?? "PharmProductImageResolver/1.0";
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? 800);
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const cache = new Map<string, ProductImageProviderCandidate | null>();
  let lastRequestAt = 0;
  return {
    name: "OPEN_PRODUCTS_FACTS",
    allowedImageHosts: OPEN_PRODUCTS_FACTS_IMAGE_HOSTS,
    async findByGtin(gtin14) {
      const normalized = normalizeGtin(gtin14);
      if (!normalized) return null;
      if (cache.has(normalized)) return cache.get(normalized) ?? null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const delay = minIntervalMs - (Date.now() - lastRequestAt);
        if (delay > 0) await sleep(delay);
        lastRequestAt = Date.now();
        const response = await fetcher(buildOpenProductsFactsUrl(normalized), {
          headers: {
            accept: "application/json",
            "user-agent": userAgent,
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 404) {
          cache.set(normalized, null);
          return null;
        }
        if ((response.status === 429 || response.status === 503) && attempt === 0) {
          const retryAfterSeconds = Number(response.headers.get("retry-after"));
          const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
            ? Math.min(120_000, retryAfterSeconds * 1_000)
            : 60_000;
          await sleep(Math.max(minIntervalMs, retryAfterMs));
          continue;
        }
        if (!response.ok) throw new Error(`Open Products Facts returned HTTP ${response.status}.`);
        const payload = await response.json();
        const candidate = parseOpenProductsFactsResponse(payload, normalized);
        cache.set(normalized, candidate);
        if (cache.size > 500) cache.delete(cache.keys().next().value as string);
        return candidate;
      }
      throw new Error("Open Products Facts retry limit was reached.");
    },
  };
}
