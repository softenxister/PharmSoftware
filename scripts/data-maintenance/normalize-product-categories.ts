import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@server/generated/prisma/client";
import { NORMALIZED_PRODUCT_CATEGORIES } from "../../src/lib/productCategories";
import { normalizePostgresConnectionString } from "@server/db/core/postgresConnection";
import { classifyProductCategory } from "@server/import/productCategoryNormalization";

const shouldApply = process.argv.includes("--apply");
const shouldAuditFallback = process.argv.includes("--audit-fallback");
const shouldAuditTerms = process.argv.includes("--audit-terms");
const auditOffsetArgument = process.argv.find((argument) => argument.startsWith("--audit-offset="));
const auditOffset = Number.parseInt(auditOffsetArgument?.split("=")[1] ?? "0", 10);
const fallbackCategory = "Other Medicines & Health Products";
const minimumReassignmentRate = 0.25;
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
  const classification = classifyProductCategory({
    itemName: product.itemName,
    brandName: product.brandName,
    genericName,
    sourceCategory: product.category.name,
  }, {
    reevaluateFallback: product.category.name === fallbackCategory,
  });
  return {
    productId: product.id,
    itemName: product.itemName,
    brandName: product.brandName,
    genericName,
    oldCategory: product.category.name,
    newCategory: classification.category,
    confidence: classification.confidence,
    reason: classification.reason,
  };
});

function countByCategory(field: "oldCategory" | "newCategory") {
  return [...assignments.reduce((counts, assignment) => {
    const category = assignment[field];
    counts.set(category, (counts.get(category) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].sort((left, right) => right[1] - left[1]);
}

const beforeCategoryCounts = countByCategory("oldCategory");
const afterCategoryCounts = countByCategory("newCategory");
const reassignments = assignments.filter((assignment) => (
  assignment.oldCategory === fallbackCategory
  && assignment.newCategory !== fallbackCategory
  && assignment.confidence === "high"
));
const manualCategoryChanges = assignments.filter((assignment) => (
  assignment.oldCategory !== fallbackCategory
  && assignment.oldCategory !== assignment.newCategory
));
const conflicts = assignments.filter((assignment) => assignment.reason.startsWith("conflict:"));
const conflictSamples = conflicts.slice(0, 20).map(({
  productId,
  itemName,
  brandName,
  genericName,
  reason,
}) => ({ productId, itemName, brandName, genericName, reason }));
const fallbackBefore = assignments.filter((assignment) => (
  assignment.oldCategory === fallbackCategory
)).length;
const fallbackAfter = assignments.filter((assignment) => (
  assignment.newCategory === fallbackCategory
)).length;
const reassignmentRate = fallbackBefore === 0 ? 0 : reassignments.length / fallbackBefore;
const reasonCounts = [...reassignments.reduce((counts, assignment) => {
  counts.set(assignment.reason, (counts.get(assignment.reason) ?? 0) + 1);
  return counts;
}, new Map<string, number>())].sort((left, right) => right[1] - left[1]);
const destinationCounts = [...reassignments.reduce((counts, assignment) => {
  counts.set(assignment.newCategory, (counts.get(assignment.newCategory) ?? 0) + 1);
  return counts;
}, new Map<string, number>())].sort((left, right) => right[1] - left[1]);
const samplesByDestination = Object.fromEntries(destinationCounts.map(([category]) => [
  category,
  reassignments
    .filter((assignment) => assignment.newCategory === category)
    .slice(0, 8)
    .map(({ productId, itemName, brandName, reason }) => ({
      productId,
      itemName,
      brandName,
      reason,
    })),
]));
const unresolvedAssignments = assignments.filter((assignment) => (
  assignment.newCategory === fallbackCategory
));
const unresolvedBrandCounts = [...unresolvedAssignments.reduce((counts, assignment) => {
  const brand = assignment.brandName.trim() || "(blank)";
  counts.set(brand, (counts.get(brand) ?? 0) + 1);
  return counts;
}, new Map<string, number>())].sort((left, right) => right[1] - left[1]);
const auditBrandArgument = process.argv.find((argument) => argument.startsWith("--audit-brand="));
const auditBrand = auditBrandArgument?.slice("--audit-brand=".length);
const termAuditAssignments = auditBrand
  ? unresolvedAssignments.filter((assignment) => assignment.brandName === auditBrand)
  : unresolvedAssignments;
const ignoredAuditTokens = new Set([
  "mg", "ml", "gm", "cm", "cc", "tab", "tabs", "tablet", "tablets", "cap", "caps",
  "cream", "gel", "syrup", "pack", "pcs", "size", "สูตร", "ชนิด", "กล่อง", "เม็ด",
]);
const termCounts = shouldAuditTerms
  ? [...termAuditAssignments.reduce((counts, assignment) => {
      const tokens = assignment.itemName
        .normalize("NFKC")
        .toLocaleLowerCase("en-US")
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
        .trim()
        .split(/\s+/)
        .filter((token) => (
          token.length >= 3
          && !/\d/.test(token)
          && !ignoredAuditTokens.has(token)
        ));
      const terms = new Set([
        ...tokens,
        ...tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`),
      ]);
      for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort((left, right) => right[1] - left[1])
  : [];
const unresolvedBrandAudit = shouldAuditFallback
  ? unresolvedBrandCounts.slice(auditOffset, auditOffset + 40).map(([brandName, count]) => ({
      brandName,
      count,
      samples: unresolvedAssignments
        .filter((assignment) => (assignment.brandName.trim() || "(blank)") === brandName)
        .slice(0, 6)
        .map(({ productId, itemName, genericName }) => ({ productId, itemName, genericName })),
    }))
  : undefined;
const report = {
  productCount: assignments.length,
  fallbackBefore,
  fallbackAfter,
  reassigned: reassignments.length,
  reassignmentRate: Number(reassignmentRate.toFixed(4)),
  conflicts: conflicts.length,
  conflictSamples,
  manualCategoryChanges: manualCategoryChanges.length,
  beforeCategoryCounts,
  afterCategoryCounts,
  destinationCounts,
  reasonCounts,
  samplesByDestination,
  ...(unresolvedBrandAudit ? { unresolvedBrandAudit } : {}),
};

if (shouldAuditFallback) {
  console.log(JSON.stringify({
    mode: "fallback-audit",
    fallbackAfter,
    auditOffset,
    unresolvedBrandAudit,
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

if (shouldAuditTerms) {
  console.log(JSON.stringify({
    mode: "term-audit",
    fallbackAfter,
    auditBrand: auditBrand ?? null,
    terms: termCounts.slice(auditOffset, auditOffset + 100).map(([term, count]) => ({
      term,
      count,
      samples: termAuditAssignments
        .filter((assignment) => assignment.itemName.toLocaleLowerCase("en-US").includes(term))
        .slice(0, 4)
        .map(({ itemName, brandName }) => ({ itemName, brandName })),
    })),
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

if (!shouldApply) {
  console.log(JSON.stringify({
    mode: "preview",
    ...report,
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

if (manualCategoryChanges.length > 0) {
  throw new Error(`Refusing to apply ${manualCategoryChanges.length} changes to non-fallback categories.`);
}
if (reassignmentRate < minimumReassignmentRate) {
  throw new Error(
    `Refusing to apply: ${(reassignmentRate * 100).toFixed(1)}% is below the `
    + `${minimumReassignmentRate * 100}% audited coverage threshold.`,
  );
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDirectory = path.join(
  process.cwd(),
  "data",
  "outputs",
  "product-category-normalization-backups",
);
const backupPath = path.join(backupDirectory, `${timestamp}.json`);
await fs.mkdir(backupDirectory, { recursive: true });
await fs.writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  normalizedCategories: NORMALIZED_PRODUCT_CATEGORIES,
  report,
  assignments: reassignments,
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
  const fallbackCategoryId = categoryIdByName.get(fallbackCategory);
  if (!fallbackCategoryId) throw new Error(`Fallback category '${fallbackCategory}' was not created.`);

  let updatedProductCount = 0;
  for (const [categoryName] of destinationCounts) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) throw new Error(`Normalized category '${categoryName}' was not created.`);
    const productIds = reassignments
      .filter((assignment) => assignment.newCategory === categoryName)
      .map((assignment) => assignment.productId);
    for (let index = 0; index < productIds.length; index += 500) {
      const result = await tx.product.updateMany({
        where: {
          id: { in: productIds.slice(index, index + 500) },
          categoryId: fallbackCategoryId,
        },
        data: { categoryId },
      });
      updatedProductCount += result.count;
    }
  }
  if (updatedProductCount !== reassignments.length) {
    throw new Error(
      `Concurrent category change detected: expected ${reassignments.length} updates, `
      + `updated ${updatedProductCount}.`,
    );
  }
}, { maxWait: 10_000, timeout: 300_000 });

console.log(JSON.stringify({
  mode: "applied",
  ...report,
  backupPath,
}, null, 2));
await prisma.$disconnect();
