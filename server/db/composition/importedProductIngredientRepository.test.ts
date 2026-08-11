import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@server/generated/prisma/client";
import {
  buildImportedProductIngredientRows,
  replaceImportedProductIngredients,
} from "./importedProductIngredientRepository";

test("imported combination names become separate normalized ingredient and link rows", () => {
  const rows = buildImportedProductIngredientRows([
    { productId: "product-1", genericName: "Dextromethorphan/Guaifenesin" },
    { productId: "product-2", genericName: "Glipizide, Metformin" },
  ]);

  assert.deepEqual(
    rows.links.map(({ productId, sourceValue }) => ({ productId, sourceValue })),
    [
      { productId: "product-1", sourceValue: "Dextromethorphan" },
      { productId: "product-1", sourceValue: "Guaifenesin" },
      { productId: "product-2", sourceValue: "Glipizide" },
      { productId: "product-2", sourceValue: "Metformin" },
    ],
  );
  assert.ok(rows.ingredients.every(({ canonicalName }) => !/[+,;/&|]/.test(canonicalName)));
});

test("imported salts reuse the existing canonical ingredient identity", () => {
  const rows = buildImportedProductIngredientRows([
    { productId: "product-1", genericName: "Chlorpheniramine Maleate+Paracetamol" },
  ]);

  assert.deepEqual(rows.links.map(({ ingredientId }) => ingredientId), [
    "ingredient-chlorpheniramine",
    "ingredient-paracetamol",
  ]);
});

test("database replacement writes separate ingredient links", async () => {
  const createdIngredients: Array<{ id: string; normalizedName: string }> = [];
  const deletedProductIds: string[][] = [];
  const createdLinks: Array<{ productId: string; sourceValue: string }> = [];
  const tx = {
    ingredient: {
      createMany: async ({ data }: { data: typeof createdIngredients }) => {
        createdIngredients.push(...data);
      },
      findMany: async () => createdIngredients.map(({ id, normalizedName }) => ({ id, normalizedName })),
    },
    productImportedIngredient: {
      deleteMany: async ({ where }: { where: { productId: { in: string[] } } }) => {
        deletedProductIds.push(where.productId.in);
      },
      createMany: async ({ data }: { data: typeof createdLinks }) => {
        createdLinks.push(...data);
      },
    },
  } as unknown as Prisma.TransactionClient;

  await replaceImportedProductIngredients(tx, [{
    productId: "product-1",
    genericName: "Dextromethorphan+Guaifenesin",
  }]);

  assert.deepEqual(deletedProductIds, [["product-1"]]);
  assert.deepEqual(createdLinks.map(({ sourceValue }) => sourceValue), [
    "Dextromethorphan",
    "Guaifenesin",
  ]);
});

test("database replacement preserves old links when an ingredient cannot be resolved", async () => {
  let deleted = false;
  const tx = {
    ingredient: {
      createMany: async () => undefined,
      findMany: async () => [],
    },
    productImportedIngredient: {
      deleteMany: async () => {
        deleted = true;
      },
      createMany: async () => undefined,
    },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(
    replaceImportedProductIngredients(tx, [{
      productId: "product-1",
      genericName: "Dextromethorphan+Guaifenesin",
    }]),
    /Imported ingredient could not be resolved/,
  );
  assert.equal(deleted, false);
});

test("imported ingredient schema and backfill are additive", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260811120000_imported_product_ingredients/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /model ProductImportedIngredient/);
  assert.match(migration, /CREATE TABLE "ProductImportedIngredient"/);
  assert.match(migration, /regexp_split_to_table/);
  assert.doesNotMatch(migration, /(?:\bDELETE\s+FROM|TRUNCATE|DROP)/i);
});

test("combination resplit migration rebuilds links without separator-valued ingredients", () => {
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260811143000_resplit_imported_ingredient_combinations/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /regexp_split_to_table/);
  assert.match(migration, /\[\+\,;\/&\|\]/);
  assert.match(migration, /DELETE FROM "ProductImportedIngredient"/);
  assert.match(migration, /DELETE FROM "Ingredient"/);
});

test("follow-up cleanup removes only unreferenced generated combination dictionary rows", () => {
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260811150000_remove_orphan_combination_ingredients/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /\(and|และ\)/);
  assert.match(migration, /ingredient\.id LIKE 'ingredient-imported-%'/);
  assert.match(migration, /NOT EXISTS[\s\S]+"ProductIngredient"/);
  assert.match(migration, /NOT EXISTS[\s\S]+"ProductImportedIngredient"/);
});
