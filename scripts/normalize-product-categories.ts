import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { NORMALIZED_PRODUCT_CATEGORIES } from "../src/lib/productCategories";
import { normalizePostgresConnectionString } from "../src/server/db/postgresConnection";
import { normalizeProductCategory } from "../src/server/import/productCategoryNormalization";

const shouldApply = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: normalizePostgresConnectionString(connectionString) }),
});

const products = await prisma.product.findMany({
  select: {
    id: true,
    itemName: true,
    brandName: true,
    category: { select: { name: true } },
    activeIngredients: {
      select: {
        ingredient: {
          select: { canonicalName: true, thaiName: true },
        },
      },
    },
  },
  orderBy: { id: "asc" },
});

const assignments = products.map((product) => {
  const genericName = product.activeIngredients.flatMap(({ ingredient }) => [
    ingredient.canonicalName,
    ingredient.thaiName ?? "",
  ]).join(" ");
  return {
    productId: product.id,
    itemName: product.itemName,
    oldCategory: product.category.name,
    newCategory: normalizeProductCategory({
      itemName: product.itemName,
      brandName: product.brandName,
      genericName,
      sourceCategory: product.category.name,
    }),
  };
});

const categoryCounts = [...assignments.reduce((counts, assignment) => {
  counts.set(assignment.newCategory, (counts.get(assignment.newCategory) ?? 0) + 1);
  return counts;
}, new Map<string, number>())].sort((left, right) => right[1] - left[1]);

if (!shouldApply) {
  console.log(JSON.stringify({
    mode: "preview",
    productCount: assignments.length,
    categoryCounts,
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDirectory = path.join(process.cwd(), "outputs", "product-category-normalization-backups");
const backupPath = path.join(backupDirectory, `${timestamp}.json`);
await fs.mkdir(backupDirectory, { recursive: true });
await fs.writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  normalizedCategories: NORMALIZED_PRODUCT_CATEGORIES,
  assignments,
}, null, 2));

await prisma.$transaction(async (tx) => {
  const categoryNames = NORMALIZED_PRODUCT_CATEGORIES.map(({ nameEn }) => nameEn);
  await tx.category.createMany({
    data: categoryNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const categories = await tx.category.findMany({
    where: { name: { in: categoryNames } },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

  for (const [categoryName] of categoryCounts) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) throw new Error(`Normalized category '${categoryName}' was not created.`);
    const productIds = assignments
      .filter((assignment) => assignment.newCategory === categoryName)
      .map((assignment) => assignment.productId);
    for (let index = 0; index < productIds.length; index += 500) {
      await tx.product.updateMany({
        where: { id: { in: productIds.slice(index, index + 500) } },
        data: { categoryId },
      });
    }
  }

  await tx.category.deleteMany({
    where: {
      name: { notIn: categoryNames },
      products: { none: {} },
    },
  });
}, { maxWait: 10_000, timeout: 300_000 });

console.log(JSON.stringify({
  mode: "applied",
  productCount: assignments.length,
  categoryCounts,
  backupPath,
}, null, 2));
await prisma.$disconnect();
