import { Prisma } from "@/generated/prisma/client";
import { extractProductMeasurement } from "@/lib/productMeasurement";
import { prisma } from "./prisma";

export type ProductMeasurementNormalizationCandidate = {
  id: string;
  itemName: string;
  currentPackUnit: string;
  currentChildQuantity: number;
  currentChildUnit: string;
  currentPackLabel: string;
};

export type ProductMeasurementNormalizationResult = {
  evaluatedCount: number;
  changedCount: number;
  unchangedCount: number;
};

type ProductMeasurementNormalizationChange = {
  productId: string;
  childQuantity: number;
  childUnit: string;
  packLabel: string;
};

export type ProductMeasurementNormalizationPlan = ProductMeasurementNormalizationResult & {
  changes: ProductMeasurementNormalizationChange[];
};

export const PRODUCT_MEASUREMENT_NORMALIZATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 300_000,
} as const;

const PRODUCT_MEASUREMENT_NORMALIZATION_BATCH_SIZE = 1_000;

function batchesOf<T>(rows: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += PRODUCT_MEASUREMENT_NORMALIZATION_BATCH_SIZE) {
    batches.push(rows.slice(index, index + PRODUCT_MEASUREMENT_NORMALIZATION_BATCH_SIZE));
  }
  return batches;
}

export function buildProductMeasurementNormalizationPlan(
  candidates: readonly ProductMeasurementNormalizationCandidate[],
): ProductMeasurementNormalizationPlan {
  const changes = candidates.flatMap((candidate): ProductMeasurementNormalizationChange[] => {
    const measurement = extractProductMeasurement({
      itemName: candidate.itemName,
      pack: {
        packUnit: candidate.currentPackUnit,
        childUnit: candidate.currentChildUnit,
        childQuantity: candidate.currentChildQuantity,
        label: candidate.currentPackLabel,
      },
    });
    if (
      !measurement
      || (
        measurement.quantity === candidate.currentChildQuantity
        && measurement.unit === candidate.currentChildUnit
        && measurement.label === candidate.currentPackLabel
      )
    ) {
      return [];
    }
    return [{
      productId: candidate.id,
      childQuantity: measurement.quantity,
      childUnit: measurement.unit,
      packLabel: measurement.label,
    }];
  });

  return {
    evaluatedCount: candidates.length,
    changedCount: changes.length,
    unchangedCount: candidates.length - changes.length,
    changes,
  };
}

export async function normalizeAllProductMeasurements(): Promise<ProductMeasurementNormalizationResult> {
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      select: {
        id: true,
        itemName: true,
        packUnit: true,
        childQuantity: true,
        childUnit: true,
        packLabel: true,
      },
    });
    const plan = buildProductMeasurementNormalizationPlan(products.map((product) => ({
      id: product.id,
      itemName: product.itemName,
      currentPackUnit: product.packUnit,
      currentChildQuantity: Number(product.childQuantity),
      currentChildUnit: product.childUnit,
      currentPackLabel: product.packLabel,
    })));
    const changesByMeasurement = new Map<string, ProductMeasurementNormalizationChange[]>();
    for (const change of plan.changes) {
      const key = JSON.stringify([change.childQuantity, change.childUnit, change.packLabel]);
      const groupedChanges = changesByMeasurement.get(key);
      if (groupedChanges) groupedChanges.push(change);
      else changesByMeasurement.set(key, [change]);
    }

    let changedCount = 0;
    for (const changes of changesByMeasurement.values()) {
      const [{ childQuantity, childUnit, packLabel }] = changes;
      for (const batch of batchesOf(changes)) {
        const result = await tx.product.updateMany({
          where: { id: { in: batch.map((change) => change.productId) } },
          data: { childQuantity, childUnit, packLabel },
        });
        changedCount += result.count;
      }
    }

    return {
      evaluatedCount: plan.evaluatedCount,
      changedCount,
      unchangedCount: plan.evaluatedCount - changedCount,
    };
  }, PRODUCT_MEASUREMENT_NORMALIZATION_TRANSACTION_OPTIONS);
}
