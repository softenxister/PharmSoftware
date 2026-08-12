const OPEN_FDA_NDC_ENDPOINT = "https://api.fda.gov/drug/ndc.json";
const LOOKUP_TIMEOUT_MS = 8_000;

type ProductLookupInput = {
  barcode: string;
  itemName: string;
  brandName: string;
  manufacturerName: string;
};

export type CompositionLookupResult = {
  sourceName: "openFDA NDC Directory";
  sourceRecordId?: string;
  sourceUrl: string;
  dosageForm?: string;
  ingredients: Array<{ name: string; strength?: string }>;
};

type OpenFdaProduct = {
  product_id?: unknown;
  brand_name?: unknown;
  labeler_name?: unknown;
  active_ingredients?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function parsedIngredients(value: unknown): Array<{ name: string; strength?: string }> {
  if (!Array.isArray(value)) return [];
  const ingredients = value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Record<string, unknown>;
    const name = text(record.name);
    if (!name || name.length > 200) return [];
    const strength = text(record.strength);
    return [{ name, ...(strength && strength.length <= 100 ? { strength } : {}) }];
  });
  return [...new Map(ingredients.map((ingredient) => [normalized(ingredient.name), ingredient])).values()];
}

async function fetchRecords(search: string): Promise<{ records: OpenFdaProduct[]; sourceUrl: string } | null> {
  const url = new URL(OPEN_FDA_NDC_ENDPOINT);
  url.searchParams.set("search", search);
  url.searchParams.set("limit", "10");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      redirect: "error",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`openFDA returned ${response.status}.`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const results = (payload as Record<string, unknown>).results;
    return Array.isArray(results) ? { records: results as OpenFdaProduct[], sourceUrl: url.toString() } : null;
  } finally {
    clearTimeout(timeout);
  }
}

function escapedExact(value: string): string {
  return value.replace(/[\\"]/g, "\\$&");
}

function unambiguousResult(
  lookup: ProductLookupInput,
  fetched: { records: OpenFdaProduct[]; sourceUrl: string } | null,
): CompositionLookupResult | null {
  if (!fetched) return null;
  const normalizedBrand = normalized(lookup.brandName);
  const normalizedManufacturer = normalized(lookup.manufacturerName);
  const candidates = fetched.records
    .map((record) => ({
      record,
      ingredients: parsedIngredients(record.active_ingredients),
      brand: normalized(text(record.brand_name)),
      manufacturer: normalized(text(record.labeler_name)),
    }))
    .filter((candidate) => candidate.ingredients.length > 0)
    .filter((candidate) => !normalizedBrand || candidate.brand === normalizedBrand);
  if (candidates.length === 0) return null;

  const manufacturerMatches = normalizedManufacturer
    ? candidates.filter((candidate) => (
        candidate.manufacturer.includes(normalizedManufacturer)
        || normalizedManufacturer.includes(candidate.manufacturer)
      ))
    : [];
  const narrowed = manufacturerMatches.length > 0 ? manufacturerMatches : candidates;
  const signatures = new Map<string, typeof narrowed>();
  for (const candidate of narrowed) {
    const signature = candidate.ingredients.map((ingredient) => normalized(ingredient.name)).sort().join("|");
    signatures.set(signature, [...(signatures.get(signature) ?? []), candidate]);
  }
  if (signatures.size !== 1) return null;

  const selected = narrowed[0];
  return {
    sourceName: "openFDA NDC Directory",
    sourceRecordId: text(selected.record.product_id) || undefined,
    sourceUrl: fetched.sourceUrl,
    ingredients: selected.ingredients,
  };
}

export async function lookupOpenFdaComposition(lookup: ProductLookupInput): Promise<CompositionLookupResult | null> {
  const barcode = lookup.barcode.replace(/\D/g, "");
  if (barcode.length >= 8) {
    const byBarcode = await fetchRecords(`openfda.upc:"${escapedExact(barcode)}"`);
    const barcodeResult = unambiguousResult(lookup, byBarcode);
    if (barcodeResult) return barcodeResult;
  }

  const brandName = lookup.brandName.trim();
  if (brandName.length < 3) return null;
  const byBrand = await fetchRecords(`brand_name.exact:"${escapedExact(brandName)}"`);
  return unambiguousResult(lookup, byBrand);
}
