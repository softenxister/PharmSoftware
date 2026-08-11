import type { Prisma } from "@server/generated/prisma/client";
import { canonicalIngredient } from "@server/composition/ingredientNormalization";
import { splitImportedGenericName } from "@/lib/importedGenericName";

const WRITE_BATCH_SIZE = 1_000;
const IMPORT_SOURCE_NAME = "CW stock import";

type ImportedProductGenericName = {
  productId: string;
  genericName: string | null | undefined;
};

export function buildImportedProductIngredientRows(
  sources: readonly ImportedProductGenericName[],
) {
  const ingredientsByNormalizedName = new Map<string, ReturnType<typeof canonicalIngredient>>();
  const linksByIdentity = new Map<string, {
    productId: string;
    ingredientId: string;
    sourceValue: string;
  }>();

  for (const source of sources) {
    for (const sourceValue of splitImportedGenericName(source.genericName ?? "")) {
      const ingredient = canonicalIngredient(sourceValue);
      if (!ingredient.normalizedName) continue;
      ingredientsByNormalizedName.set(ingredient.normalizedName, ingredient);
      linksByIdentity.set(`${source.productId}\u0000${ingredient.id}`, {
        productId: source.productId,
        ingredientId: ingredient.id,
        sourceValue,
      });
    }
  }

  return {
    ingredients: [...ingredientsByNormalizedName.values()],
    links: [...linksByIdentity.values()],
  };
}

export async function replaceImportedProductIngredients(
  tx: Prisma.TransactionClient,
  sources: readonly ImportedProductGenericName[],
): Promise<void> {
  const productIds = [...new Set(sources.map(({ productId }) => productId))];
  if (productIds.length === 0) return;

  const rows = buildImportedProductIngredientRows(sources);
  for (let index = 0; index < rows.ingredients.length; index += WRITE_BATCH_SIZE) {
    await tx.ingredient.createMany({
      data: rows.ingredients.slice(index, index + WRITE_BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  const normalizedNames = rows.ingredients.map(({ normalizedName }) => normalizedName);
  const savedIngredients = normalizedNames.length > 0
    ? await tx.ingredient.findMany({
        where: { normalizedName: { in: normalizedNames } },
        select: { id: true, normalizedName: true },
      })
    : [];
  const savedIdByNormalizedName = new Map(
    savedIngredients.map(({ id, normalizedName }) => [normalizedName, id]),
  );
  const normalizedNameByPlannedId = new Map(
    rows.ingredients.map(({ id, normalizedName }) => [id, normalizedName]),
  );

  const links = rows.links.map((link) => {
    const normalizedName = normalizedNameByPlannedId.get(link.ingredientId);
    const ingredientId = normalizedName ? savedIdByNormalizedName.get(normalizedName) : undefined;
    if (!ingredientId) {
      throw new Error(`Imported ingredient could not be resolved: ${link.sourceValue}`);
    }
    return {
      productId: link.productId,
      ingredientId,
      sourceName: IMPORT_SOURCE_NAME,
      sourceValue: link.sourceValue,
    };
  });

  await tx.productImportedIngredient.deleteMany({ where: { productId: { in: productIds } } });
  for (let index = 0; index < links.length; index += WRITE_BATCH_SIZE) {
    await tx.productImportedIngredient.createMany({
      data: links.slice(index, index + WRITE_BATCH_SIZE),
      skipDuplicates: true,
    });
  }
}
