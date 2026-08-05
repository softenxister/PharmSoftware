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

export function latestProductCost(
  latestPurchaseCost: PurchaseCostObservation | undefined,
  migrationCostThb?: number | null,
): number | undefined {
  const purchaseCost = latestPurchaseCost
    ? normalizePurchaseCost(latestPurchaseCost.costThb, latestPurchaseCost.unitMultiplier)
    : undefined;
  if (purchaseCost !== undefined) return roundCurrency(purchaseCost);
  if (migrationCostThb === null || migrationCostThb === undefined
    || !Number.isFinite(migrationCostThb) || migrationCostThb <= 0) return undefined;
  return roundCurrency(migrationCostThb);
}

export function markupPercent(
  sellPriceThb: number,
  costThb?: number,
): number | undefined {
  if (!Number.isFinite(sellPriceThb) || sellPriceThb <= 0) return undefined;
  if (costThb === undefined
    || !Number.isFinite(costThb) || costThb <= 0) return undefined;
  return roundCurrency(((sellPriceThb - costThb) / costThb) * 100);
}
