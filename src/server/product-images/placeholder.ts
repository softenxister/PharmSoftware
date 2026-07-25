const MAX_BRAND_LENGTH = 48;
const PLACEHOLDER_IMAGE_HOSTS = [
  "placehold.co",
  "placeholder.com",
  "placehold.it",
] as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolvePlaceholderBrand(brandName: string | null | undefined): string {
  const trimmed = brandName?.trim() ?? "";
  const valid = trimmed && trimmed.toLocaleLowerCase("en-US") !== "unspecified"
    ? trimmed
    : "Invalid";
  const characters = Array.from(valid);
  return characters.length <= MAX_BRAND_LENGTH
    ? valid
    : `${characters.slice(0, MAX_BRAND_LENGTH - 1).join("")}…`;
}

export function productImageUrl(productId: string, version?: string): string {
  const url = `/api/product-images/${encodeURIComponent(productId)}`;
  const cleanVersion = version?.trim();
  return cleanVersion ? `${url}?v=${encodeURIComponent(cleanVersion)}` : url;
}

export function isPlaceholderProductImageUrl(source: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(source).hostname.toLocaleLowerCase("en-US");
  } catch {
    return false;
  }
  return PLACEHOLDER_IMAGE_HOSTS.some(
    (placeholderHost) => (
      hostname === placeholderHost
      || hostname.endsWith(`.${placeholderHost}`)
    ),
  );
}

export function createUnresolvedProductSvg(brandName: string | null | undefined): string {
  const brand = escapeXml(resolvePlaceholderBrand(brandName));
  const fontSize = Array.from(brand).length > 28 ? 44 : Array.from(brand).length > 18 ? 52 : 62;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="${brand}, no verified image">`,
    `<rect width="720" height="720" rx="36" fill="#ffffff"/>`,
    `<rect x="18" y="18" width="684" height="684" rx="28" fill="none" stroke="#d7e7dc" stroke-width="4"/>`,
    `<path d="M310 214h100M360 164v100" stroke="#5d8a6b" stroke-width="16" stroke-linecap="round"/>`,
    `<text x="360" y="376" text-anchor="middle" fill="#14532d" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${brand}</text>`,
    `<text x="360" y="438" text-anchor="middle" fill="#52705b" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="500">No verified image</text>`,
    `</svg>`,
  ].join("");
}
