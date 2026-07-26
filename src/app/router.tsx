import type { ComponentType } from "react";
import { Navigate, createBrowserRouter } from "react-router";
import { AppBoundary, SessionLoading } from "./AppBoundary";

const lazyPage = async <T extends { default: ComponentType }>(module: Promise<T>) => {
  const loaded = await module;
  return { Component: loaded.default };
};

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppBoundary,
    HydrateFallback: SessionLoading,
    children: [
      { index: true, lazy: () => lazyPage(import("@/pages/dashboard/DashboardPage")) },
      { path: "analysis", lazy: () => lazyPage(import("@/pages/analysis/AnalysisPage")) },
      { path: "change-password", lazy: () => lazyPage(import("@/pages/change-password/ChangePasswordPage")) },
      { path: "integrations", lazy: () => lazyPage(import("@/pages/integrations/IntegrationsPage")) },
      { path: "login", lazy: () => lazyPage(import("@/pages/login/LoginPage")) },
      { path: "member", lazy: () => lazyPage(import("@/pages/member/MemberListPage")) },
      { path: "member/:memberId", lazy: () => lazyPage(import("@/pages/member/MemberDetailPage")) },
      { path: "more", lazy: () => lazyPage(import("@/pages/more/MorePage")) },
      { path: "purchase", lazy: () => lazyPage(import("@/pages/purchase/PurchasePage")) },
      { path: "purchase/new", lazy: () => lazyPage(import("@/pages/purchase/PurchaseEntryPage")) },
      { path: "sales", lazy: () => lazyPage(import("@/pages/sales/SalesPage")) },
      { path: "sales/new", lazy: () => lazyPage(import("@/pages/sales/NewSalePage")) },
      { path: "sales/receipt/:saleId", lazy: () => lazyPage(import("@/pages/sales/ReceiptPage")) },
      { path: "settings", lazy: () => lazyPage(import("@/pages/settings/SettingsPage")) },
      { path: "stock", lazy: () => lazyPage(import("@/pages/stock/StockPage")) },
      { path: "stock/adjustment", lazy: () => lazyPage(import("@/pages/stock/StockAdjustmentPage")) },
      { path: "stock/discounts", lazy: () => lazyPage(import("@/pages/stock/StockDiscountsPage")) },
      { path: "stock/migration", lazy: () => lazyPage(import("@/pages/stock/StockMigrationPage")) },
      { path: "stock/min-max", lazy: () => lazyPage(import("@/pages/stock/StockMinMaxPage")) },
      { path: "*", Component: () => <Navigate to="/" replace /> },
    ],
  },
]);
