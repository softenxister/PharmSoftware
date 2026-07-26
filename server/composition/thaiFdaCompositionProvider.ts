const THAI_FDA_NDI_ENDPOINT = "https://ndi.fda.moph.go.th/drug_info/index";
const LOOKUP_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_CHARACTERS = 2_000_000;

type ProductLookupInput = {
  itemName: string;
  brandName: string;
  manufacturerName: string;
};

export type ThaiFdaCompositionLookupResult = {
  sourceName: "Thai FDA National Drug Information";
  sourceRecordId?: string;
  sourceUrl: string;
  ingredients: Array<{ name: string; strength?: string }>;
};

type ThaiFdaCandidate = {
  genericName: string;
  brandName: string;
  dosageForm: string;
  strength: string;
  manufacturerName: string;
  registrationNumber: string;
  detailUrl: string;
};

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function htmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function field(card: string, thaiLabel: string): string {
  const escapedLabel = thaiLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = card.match(new RegExp(
    `<strong>\\s*${escapedLabel}\\s*:\\s*<\\/strong>[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`,
    "i",
  ));
  return match ? htmlText(match[1]) : "";
}

export function parseThaiFdaCandidates(html: string): ThaiFdaCandidate[] {
  const cards = html.split(/<div\s+class\s*=\s*["']col-md-4\s+col-sm-6["'][^>]*>/i).slice(1);
  return cards.flatMap((card) => {
    const genericName = field(card, "ชื่อสารสำคัญ");
    const brandName = field(card, "ชื่อทางการค้า");
    if (!genericName || !brandName) return [];
    const detailHref = card.match(/href\s*=\s*["'](https:\/\/ndi\.fda\.moph\.go\.th\/drug_detail\/index\/\?[^"']+)["']/i)?.[1] ?? "";
    return [{
      genericName,
      brandName,
      dosageForm: field(card, "รูปแบบ"),
      strength: field(card, "ความแรง"),
      manufacturerName: field(card, "ผู้รับอนุญาต"),
      registrationNumber: field(card, "เลขทะเบียน"),
      detailUrl: htmlText(detailHref).replace(/&amp;/gi, "&"),
    }];
  });
}

function ingredientStrengths(genericName: string, strength: string) {
  const names = genericName.split("+").map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return [];
  const normalizedStrength = strength.trim();
  const denominator = normalizedStrength.match(/(\/\s*[^/]+)$/)?.[1] ?? "";
  const numerator = denominator
    ? normalizedStrength.slice(0, -denominator.length).replace(/^\(|\)$/g, "")
    : normalizedStrength.replace(/^\(|\)$/g, "");
  const strengths = numerator.split("+").map((value) => value.trim()).filter(Boolean);
  return names.map((name, index) => ({
    name,
    ...(strengths.length === names.length
      ? { strength: `${strengths[index]}${denominator}`.trim() }
      : normalizedStrength ? { strength: normalizedStrength } : {}),
  }));
}

function dosageFormScore(itemName: string, dosageForm: string): number {
  const item = normalized(itemName);
  const form = normalized(dosageForm);
  const formGroups = [
    ["tablet", "tab", "caplet", "effervescent tablet"],
    ["capsule", "cap"],
    ["syrup"],
    ["suspension"],
    ["cream"],
    ["gel"],
    ["solution"],
    ["powder", "oral powder", "sachet"],
  ];
  for (const group of formGroups) {
    const itemMatches = group.some((term) => item.includes(term));
    if (!itemMatches) continue;
    return group.some((term) => form.includes(term)) ? 1_000 : -1_000;
  }
  return 0;
}

function unambiguousResult(
  lookup: ProductLookupInput,
  candidates: ThaiFdaCandidate[],
  searchUrl: string,
): ThaiFdaCompositionLookupResult | null {
  const itemName = normalized(lookup.itemName);
  const brandName = normalized(lookup.brandName);
  const manufacturer = normalized(lookup.manufacturerName);
  const ranked = candidates.flatMap((candidate) => {
    const candidateBrand = normalized(candidate.brandName);
    if (!candidateBrand) return [];
    const brandFits = candidateBrand === brandName || itemName === candidateBrand || itemName.startsWith(`${candidateBrand} `);
    if (!brandFits) return [];
    const ingredients = ingredientStrengths(candidate.genericName, candidate.strength);
    if (ingredients.length === 0) return [];
    const candidateManufacturer = normalized(candidate.manufacturerName);
    const manufacturerMatch = Boolean(manufacturer && candidateManufacturer && (
      manufacturer.includes(candidateManufacturer) || candidateManufacturer.includes(manufacturer)
    ));
    return [{
      candidate,
      ingredients,
      score: candidateBrand.length + dosageFormScore(lookup.itemName, candidate.dosageForm) + (manufacturerMatch ? 100 : 0),
    }];
  }).sort((first, second) => second.score - first.score);
  if (ranked.length === 0 || ranked[0].score < 0) return null;
  const top = ranked.filter((result) => result.score === ranked[0].score);
  const signatures = new Set(top.map((result) => (
    result.ingredients.map((ingredient) => normalized(ingredient.name)).sort().join("|")
  )));
  if (signatures.size !== 1) return null;
  const selected = top[0];
  return {
    sourceName: "Thai FDA National Drug Information",
    sourceRecordId: selected.candidate.registrationNumber || undefined,
    sourceUrl: selected.candidate.detailUrl || searchUrl,
    ingredients: selected.ingredients,
  };
}

async function fetchCandidates(brand: string): Promise<{ candidates: ThaiFdaCandidate[]; sourceUrl: string }> {
  const url = new URL(THAI_FDA_NDI_ENDPOINT);
  url.searchParams.set("brand", brand);
  url.searchParams.set("drugno", "");
  url.searchParams.set("name", "");
  url.searchParams.set("rctype", "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html" },
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Thai FDA NDI returned ${response.status}.`);
    const html = await response.text();
    if (html.length > MAX_RESPONSE_CHARACTERS) throw new Error("Thai FDA NDI response was unexpectedly large.");
    return { candidates: parseThaiFdaCandidates(html), sourceUrl: url.toString() };
  } finally {
    clearTimeout(timeout);
  }
}

function queryCandidates(lookup: ProductLookupInput): string[] {
  const itemWords = lookup.itemName
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|s|pcs?|tablets?|capsules?)?\b/gi, " ")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const itemPrefix = itemWords.slice(0, Math.min(2, itemWords.length)).join(" ");
  return [...new Set([lookup.brandName.trim(), itemPrefix].filter((value) => value.length >= 2))].slice(0, 2);
}

export async function lookupThaiFdaComposition(
  lookup: ProductLookupInput,
): Promise<ThaiFdaCompositionLookupResult | null> {
  for (const query of queryCandidates(lookup)) {
    const fetched = await fetchCandidates(query);
    const result = unambiguousResult(lookup, fetched.candidates, fetched.sourceUrl);
    if (result) return result;
  }
  return null;
}
