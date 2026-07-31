import { Prisma } from "@server/generated/prisma/client";
import type { IngredientSummary } from "../types";
import { prisma } from "../core/prisma";

export type IngredientOption = IngredientSummary & {
  aliases: string[];
};

function normalizedSearch(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

export async function searchIngredients(rawQuery: string, limit = 30): Promise<IngredientOption[]> {
  const query = normalizedSearch(rawQuery);
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  if (!query) {
    return prisma.ingredient.findMany({
      orderBy: { canonicalName: "asc" },
      take: safeLimit,
      select: { id: true, canonicalName: true, thaiName: true, aliases: true },
    }).then((ingredients) => ingredients.map((ingredient) => ({
      id: ingredient.id,
      canonicalName: ingredient.canonicalName,
      ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
      aliases: ingredient.aliases,
    })));
  }

  const contains = `%${query}%`;
  const prefix = `${query}%`;
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    canonicalName: string;
    thaiName: string | null;
    aliases: string[];
  }>>(Prisma.sql`
    SELECT ingredient."id", ingredient."canonicalName", ingredient."thaiName", ingredient."aliases"
    FROM "Ingredient" ingredient
    WHERE ingredient."normalizedName" ILIKE ${contains}
      OR ingredient."canonicalName" ILIKE ${contains}
      OR COALESCE(ingredient."thaiName", '') ILIKE ${contains}
      OR EXISTS (
        SELECT 1 FROM unnest(ingredient."aliases") alias
        WHERE alias ILIKE ${contains}
      )
    ORDER BY
      CASE
        WHEN ingredient."normalizedName" = ${query} THEN 0
        WHEN ingredient."normalizedName" ILIKE ${prefix} THEN 1
        WHEN ingredient."canonicalName" ILIKE ${prefix} THEN 2
        WHEN COALESCE(ingredient."thaiName", '') ILIKE ${prefix} THEN 3
        ELSE 4
      END,
      ingredient."canonicalName" ASC
    LIMIT ${safeLimit}
  `);

  return rows.map((ingredient) => ({
    id: ingredient.id,
    canonicalName: ingredient.canonicalName,
    ...(ingredient.thaiName ? { thaiName: ingredient.thaiName } : {}),
    aliases: ingredient.aliases,
  }));
}

export async function ingredientIdsExist(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const count = await prisma.ingredient.count({ where: { id: { in: [...ids] } } });
  return count === new Set(ids).size;
}
