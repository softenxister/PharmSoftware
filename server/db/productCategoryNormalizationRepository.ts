import { Prisma } from "@server/generated/prisma/client";
import { classifyProductCategory } from "@server/import/productCategoryNormalization";
import { prisma } from "./prisma";

export type ProductCategoryNormalizationCandidate = {
  id: string;
  itemName: string;
  brandName: string;
  genericName: string | null;
  currentCategory: string;
};

export type ProductCategoryNormalizationResult = {
  evaluatedCount: number;
  changedCount: number;
  unchangedCount: number;
};

type ProductCategoryNormalizationChange = {
  productId: string;
  categoryName: string;
};

export type ProductCategoryNormalizationPlan = ProductCategoryNormalizationResult & {
  changes: ProductCategoryNormalizationChange[];
};

const PRODUCT_CATEGORY_NORMALIZATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 300_000,
} as const;

const PRODUCT_CATEGORY_NORMALIZATION_BATCH_SIZE = 1_000;

function batchesOf<T>(rows: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += PRODUCT_CATEGORY_NORMALIZATION_BATCH_SIZE) {
    batches.push(rows.slice(index, index + PRODUCT_CATEGORY_NORMALIZATION_BATCH_SIZE));
  }
  return batches;
}

export function buildProductCategoryNormalizationPlan(
  candidates: readonly ProductCategoryNormalizationCandidate[],
): ProductCategoryNormalizationPlan {
  const changes = candidates.flatMap((candidate): ProductCategoryNormalizationChange[] => {
    const classification = classifyProductCategory({
      itemName: candidate.itemName,
      brandName: candidate.brandName,
      genericName: candidate.genericName,
    });
    if (
      classification.confidence !== "high"
      || classification.category === candidate.currentCategory
    ) {
      return [];
    }
    return [{ productId: candidate.id, categoryName: classification.category }];
  });

  return {
    evaluatedCount: candidates.length,
    changedCount: changes.length,
    unchangedCount: candidates.length - changes.length,
    changes,
  };
}

export async function normalizeAllProductCategories(): Promise<ProductCategoryNormalizationResult> {
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
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
    });
    const plan = buildProductCategoryNormalizationPlan(products.map((product) => ({
      id: product.id,
      itemName: product.itemName,
      brandName: product.brandName,
      genericName: product.activeIngredients
        .flatMap(({ ingredient }) => [ingredient.canonicalName, ingredient.thaiName])
        .filter((name): name is string => Boolean(name))
        .join(" ") || null,
      currentCategory: product.category.name,
    })));
    if (plan.changes.length === 0) {
      return {
        evaluatedCount: plan.evaluatedCount,
        changedCount: 0,
        unchangedCount: plan.unchangedCount,
      };
    }

    const categoryNames = [...new Set(plan.changes.map((change) => change.categoryName))];
    await tx.category.createMany({
      data: categoryNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const categories = await tx.category.findMany({
      where: { name: { in: categoryNames } },
      select: { id: true, name: true },
    });
    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
    let changedCount = 0;

    for (const categoryName of categoryNames) {
      const categoryId = categoryIdByName.get(categoryName);
      if (!categoryId) throw new Error(`Normalized category "${categoryName}" could not be resolved.`);
      const productIds = plan.changes
        .filter((change) => change.categoryName === categoryName)
        .map((change) => change.productId);
      for (const productIdBatch of batchesOf(productIds)) {
        const result = await tx.product.updateMany({
          where: { id: { in: productIdBatch }, categoryId: { not: categoryId } },
          data: { categoryId },
        });
        changedCount += result.count;
      }
    }

    return {
      evaluatedCount: plan.evaluatedCount,
      changedCount,
      unchangedCount: plan.evaluatedCount - changedCount,
    };
  }, PRODUCT_CATEGORY_NORMALIZATION_TRANSACTION_OPTIONS);
}
