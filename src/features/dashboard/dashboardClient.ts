import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object"
);
const isFiniteNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);
const isNullableNumber = (value: unknown) => value === null || isFiniteNumber(value);

export function isDashboardResponse(value: unknown): value is DashboardResponse {
  if (!isRecord(value) || typeof value.generatedAt !== "string" || typeof value.date !== "string") {
    return false;
  }
  const store = value.store;
  const today = value.today;
  const inventory = value.inventory;
  if (!isRecord(store)
    || typeof store.name !== "string"
    || typeof store.openingTime !== "string"
    || typeof store.closingTime !== "string"
    || (store.isOpen !== null && typeof store.isOpen !== "boolean")) {
    return false;
  }
  if (!isRecord(today)
    || !isFiniteNumber(today.netSales)
    || !isFiniteNumber(today.netPurchases)
    || !isFiniteNumber(today.paidBills)
    || !isFiniteNumber(today.memberBills)
    || !isNullableNumber(today.averageBill)
    || !isNullableNumber(today.netSalesChangePercent)
    || !isNullableNumber(today.averageBillChangePercent)) {
    return false;
  }
  if (!isRecord(inventory)
    || !isFiniteNumber(inventory.outOfStock)
    || !isFiniteNumber(inventory.lowStock)
    || !isFiniteNumber(inventory.expiringWithin30Days)
    || !Array.isArray(inventory.items)
    || !inventory.items.every((item) => isRecord(item)
      && typeof item.productId === "string"
      && typeof item.name === "string"
      && item.reason === "expired"
      && isFiniteNumber(item.availableStock)
      && typeof item.expiryDate === "string"
      && typeof item.imageUrl === "string"
      && item.imageUrl.length > 0)) {
    return false;
  }
  if (!Array.isArray(value.hourlySales)
    || !value.hourlySales.every((point) => isRecord(point)
      && typeof point.hour === "string"
      && isNullableNumber(point.today)
      && isFiniteNumber(point.yesterday))) {
    return false;
  }
  if (!Array.isArray(value.recentSales)
    || !value.recentSales.every((sale) => isRecord(sale)
      && typeof sale.id === "string"
      && typeof sale.billNo === "string"
      && typeof sale.soldAt === "string"
      && typeof sale.customerName === "string"
      && isFiniteNumber(sale.netTotal)
      && (sale.status === "paid" || sale.status === "pending"))) {
    return false;
  }
  if (value.ownerFinancials !== undefined) {
    const financials = value.ownerFinancials;
    if (!isRecord(financials)
      || !isNullableNumber(financials.grossDifference)
      || !isNullableNumber(financials.marginPercent)
      || !isFiniteNumber(financials.pricedLines)
      || !isFiniteNumber(financials.totalLines)) {
      return false;
    }
  }
  return true;
}

export async function loadDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", { cache: "no-store", signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(body) && typeof body.error === "string"
      ? body.error
      : "Unable to load the dashboard.";
    throw new Error(error);
  }
  if (!isDashboardResponse(body)) throw new Error("Dashboard response is invalid.");
  return body;
}
