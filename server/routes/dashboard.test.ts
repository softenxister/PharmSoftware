import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import { createDashboardResponse } from "./dashboard";

const dashboard: DashboardResponse = {
  generatedAt: "2026-08-15T10:00:00.000Z",
  date: "2026-08-15",
  store: {
    name: "Community Pharmacy",
    openingTime: "08:00",
    closingTime: "22:00",
    isOpen: true,
  },
  today: {
    netSales: 4200,
    netPurchases: 1750,
    paidBills: 18,
    memberBills: 7,
    averageBill: 233.33,
    netSalesChangePercent: 8.5,
    averageBillChangePercent: null,
  },
  inventory: {
    outOfStock: 2,
    lowStock: 6,
    expiringWithin30Days: 3,
    items: [],
  },
  hourlySales: [{ hour: "08:00", today: 300, yesterday: 240 }],
  recentSales: [],
  ownerFinancials: {
    grossDifference: 1200,
    marginPercent: 28.57,
    pricedLines: 18,
    totalLines: 18,
  },
};

test("dashboard route returns a private no-store JSON response", async () => {
  const response = createDashboardResponse(dashboard);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await response.json(), dashboard);
});
