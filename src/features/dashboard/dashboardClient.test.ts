import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardResponse } from "./dashboardClient";

const validResponse = {
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
    items: [{
      productId: "product-expired",
      name: "Expired medicine",
      reason: "expired",
      availableStock: 12,
      expiryDate: "2026-08-14",
      imageUrl: "/api/product-images/product-expired?v=real-image",
    }],
  },
  hourlySales: [{ hour: "08:00", today: 300, yesterday: 240 }],
  recentSales: [],
};

test("dashboard client accepts the typed API response", () => {
  assert.equal(isDashboardResponse(validResponse), true);
});

test("dashboard client rejects malformed external responses", () => {
  assert.equal(isDashboardResponse({ ...validResponse, hourlySales: [{ hour: 8 }] }), false);
  assert.equal(isDashboardResponse({ ...validResponse, today: { netSales: "4200" } }), false);
  assert.equal(isDashboardResponse({
    ...validResponse,
    today: { ...validResponse.today, netPurchases: undefined },
  }), false);
  assert.equal(isDashboardResponse({
    ...validResponse,
    inventory: {
      ...validResponse.inventory,
      items: [{
        productId: "product-empty",
        name: "Empty stock medicine",
        reason: "out-of-stock",
        availableStock: 0,
        expiryDate: null,
        imageUrl: "/api/product-images/product-empty",
      }],
    },
  }), false);
  assert.equal(isDashboardResponse({
    ...validResponse,
    inventory: {
      ...validResponse.inventory,
      items: [{
        productId: "product-expired",
        name: "Expired medicine",
        reason: "expired",
        availableStock: 12,
        expiryDate: "2026-08-14",
      }],
    },
  }), false);
  assert.equal(isDashboardResponse(null), false);
});
