export type PurchaseCostObservation = {
  costThb: number;
  unitMultiplier: number;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizePurchaseCost(
  costThb: number,
  unitMultiplier: number,
): number | undefined {
  if (!Number.isFinite(costThb) || costThb <= 0) return undefined;
  if (!Number.isFinite(unitMultiplier) || unitMultiplier <= 0) return undefined;
  return costThb / unitMultiplier;
}

export function averageProductCost(
  distributorCosts: readonly PurchaseCostObservation[],
  migrationCostThb?: number | null,
): number | undefined {
  const normalizedCosts = distributorCosts.flatMap(({ costThb, unitMultiplier }) => {
    const cost = normalizePurchaseCost(costThb, unitMultiplier);
    return cost === undefined ? [] : [cost];
  });
  if (migrationCostThb !== null && migrationCostThb !== undefined
    && Number.isFinite(migrationCostThb) && migrationCostThb > 0) {
    normalizedCosts.push(migrationCostThb);
  }
  if (normalizedCosts.length === 0) return undefined;
  return roundCurrency(
    normalizedCosts.reduce((sum, cost) => sum + cost, 0) / normalizedCosts.length,
  );
}

export function markupPercent(
  sellPriceThb: number,
  averageCostThb?: number,
): number | undefined {
  if (!Number.isFinite(sellPriceThb) || sellPriceThb <= 0) return undefined;
  if (averageCostThb === undefined
    || !Number.isFinite(averageCostThb) || averageCostThb <= 0) return undefined;
  return roundCurrency(((sellPriceThb - averageCostThb) / averageCostThb) * 100);
}
