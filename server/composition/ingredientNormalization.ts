import { createHash } from "node:crypto";

type KnownIngredient = {
  id: string;
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
};

const KNOWN_INGREDIENTS: readonly KnownIngredient[] = [
  { id: "ingredient-acetylcysteine", canonicalName: "Acetylcysteine", normalizedName: "acetylcysteine", aliases: ["n acetylcysteine", "nac"] },
  { id: "ingredient-paracetamol", canonicalName: "Paracetamol", normalizedName: "paracetamol", aliases: ["acetaminophen"] },
  { id: "ingredient-chlorpheniramine", canonicalName: "Chlorpheniramine", normalizedName: "chlorpheniramine", aliases: ["chlorpheniramine maleate"] },
  { id: "ingredient-phenylephrine", canonicalName: "Phenylephrine", normalizedName: "phenylephrine", aliases: ["phenylephrine hydrochloride", "phenylephrine hcl"] },
  { id: "ingredient-cetirizine", canonicalName: "Cetirizine", normalizedName: "cetirizine", aliases: ["cetirizine hydrochloride", "cetirizine hcl"] },
  { id: "ingredient-simethicone", canonicalName: "Simethicone", normalizedName: "simethicone", aliases: ["simeticone"] },
  { id: "ingredient-sodium-alginate", canonicalName: "Sodium alginate", normalizedName: "sodium alginate", aliases: [] },
  { id: "ingredient-sodium-bicarbonate", canonicalName: "Sodium bicarbonate", normalizedName: "sodium bicarbonate", aliases: ["sodium hydrogen carbonate"] },
  { id: "ingredient-calcium-carbonate", canonicalName: "Calcium carbonate", normalizedName: "calcium carbonate", aliases: [] },
  { id: "ingredient-povidone-iodine", canonicalName: "Povidone-iodine", normalizedName: "povidone iodine", aliases: ["pvp i", "pvp-i", "povidone iodine"] },
  { id: "ingredient-glucose", canonicalName: "Glucose", normalizedName: "glucose", aliases: ["glucose anhydrous", "anhydrous glucose"] },
  { id: "ingredient-sodium-chloride", canonicalName: "Sodium chloride", normalizedName: "sodium chloride", aliases: [] },
  { id: "ingredient-sodium-citrate", canonicalName: "Sodium citrate", normalizedName: "sodium citrate", aliases: ["sodium citrate dihydrate", "trisodium citrate dihydrate"] },
  { id: "ingredient-potassium-chloride", canonicalName: "Potassium chloride", normalizedName: "potassium chloride", aliases: [] },
  { id: "ingredient-phenyl-salicylate", canonicalName: "Phenyl salicylate", normalizedName: "phenyl salicylate", aliases: ["salol"] },
  { id: "ingredient-menthol", canonicalName: "Menthol", normalizedName: "menthol", aliases: [] },
];

export function normalizeIngredientName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[®™]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleIngredient(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("en"));
}

export function canonicalIngredient(sourceName: string) {
  const normalizedSourceName = normalizeIngredientName(sourceName);
  const known = KNOWN_INGREDIENTS.find((ingredient) => (
    ingredient.normalizedName === normalizedSourceName
    || ingredient.aliases.includes(normalizedSourceName)
  ));
  if (known) {
    return {
      id: known.id,
      canonicalName: known.canonicalName,
      normalizedName: known.normalizedName,
      aliases: normalizedSourceName === known.normalizedName ? known.aliases : [...new Set([...known.aliases, sourceName.trim()])],
    };
  }

  const digest = createHash("sha256").update(normalizedSourceName).digest("hex").slice(0, 16);
  return {
    id: `ingredient-${digest}`,
    canonicalName: titleIngredient(sourceName.trim()),
    normalizedName: normalizedSourceName,
    aliases: [],
  };
}
