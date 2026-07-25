import type { ProductImageProviderCandidate } from "./types";

export const BRAVE_IMAGE_SEARCH_PROVIDER = "BRAVE_IMAGE_SEARCH";
export const BRAVE_IMAGE_SEARCH_HOSTS = ["imgs.search.brave.com"] as const;
export const BRAVE_IMAGE_SOURCE_RIGHTS_NOTICE =
  "Brave Search does not provide image reuse rights. Verify the source licence before approval.";

const BRAVE_IMAGE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/images/search";
const MAX_QUERY_LENGTH = 400;
const MAX_QUERY_WORDS = 50;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

type UnknownRecord = Record<string, unknown>;

export type BraveImageSearchRateLimit = {
  remaining: number | null;
  resetSeconds: number | null;
};

export type BraveImageSearchResult = {
  candidate: ProductImageProviderCandidate | null;
  rateLimit: BraveImageSearchRateLimit;
};

export class BraveImageSearchRequestError extends Error {
  constructor(readonly status: number) {
    super(`Brave Image Search returned HTTP ${status}.`);
  }
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function boundedString(value: unknown, maximum = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function safeHttpsUrl(value: unknown, allowedHosts?: readonly string[]): string | null {
  const source = boundedString(value, 2_000);
  if (!source) return null;
  try {
    const url = new URL(source);
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    if (url.protocol !== "https:" || (allowedHosts && !allowedHosts.includes(hostname))) return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function buildQuery(barcode: string, itemName: string): string {
  const words = `${barcode} ${itemName}`.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, MAX_QUERY_WORDS).join(" ").slice(0, MAX_QUERY_LENGTH).trim();
}

export function buildBraveImageSearchUrl(barcode: string, itemName: string): string {
  const url = new URL(BRAVE_IMAGE_SEARCH_ENDPOINT);
  url.searchParams.set("q", buildQuery(barcode, itemName));
  url.searchParams.set("count", "1");
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("spellcheck", "false");
  return url.toString();
}

export function parseBraveImageSearchResponse(
  payload: unknown,
  barcode: string,
  itemName: string,
): ProductImageProviderCandidate | null {
  const root = record(payload);
  const first = Array.isArray(root?.results) ? record(root.results[0]) : null;
  const thumbnail = record(first?.thumbnail);
  const sourcePageUrl = safeHttpsUrl(first?.url);
  const sourceImageUrl = safeHttpsUrl(thumbnail?.src, BRAVE_IMAGE_SEARCH_HOSTS);
  if (!first || !sourcePageUrl || !sourceImageUrl) return null;

  return {
    provider: BRAVE_IMAGE_SEARCH_PROVIDER,
    sourcePageUrl,
    sourceImageUrl,
    sourceLicence: BRAVE_IMAGE_SOURCE_RIGHTS_NOTICE,
    matchMethod: "TEXT",
    sourceIdentifierType: "BARCODE_QUERY",
    sourceIdentifierValue: boundedString(barcode, 200),
    sourceProductName: boundedString(first.title) ?? boundedString(itemName),
    sourceBrand: null,
    sourceManufacturer: null,
    sourceMarket: null,
    sourcePackCount: null,
  };
}

function parsedHeaderNumber(headers: Headers, name: string): number | null {
  const value = Number(headers.get(name));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function braveImageSearchIsConfigured(
  env: { BRAVE_SEARCH_API_KEY?: string } = process.env,
): boolean {
  return Boolean(env.BRAVE_SEARCH_API_KEY?.trim());
}

export function createBraveImageSearchClient(options: {
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
} = {}) {
  const apiKey = options.apiKey ?? process.env.BRAVE_SEARCH_API_KEY ?? "";
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = Math.max(1, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  if (!apiKey.trim()) throw new Error("Brave Image Search is not configured.");

  return {
    async search(barcode: string, itemName: string): Promise<BraveImageSearchResult> {
      const response = await fetcher(buildBraveImageSearchUrl(barcode, itemName), {
        headers: {
          accept: "application/json",
          "x-subscription-token": apiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new BraveImageSearchRequestError(response.status);
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
        throw new Error("Brave Image Search returned an oversized response.");
      }
      const payload = await response.json() as unknown;
      return {
        candidate: parseBraveImageSearchResponse(payload, barcode, itemName),
        rateLimit: {
          remaining: parsedHeaderNumber(response.headers, "x-ratelimit-remaining"),
          resetSeconds: parsedHeaderNumber(response.headers, "x-ratelimit-reset"),
        },
      };
    },
  };
}
