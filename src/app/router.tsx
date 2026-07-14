import type { ComponentType } from "react";
import { Navigate, createBrowserRouter } from "react-router";
import { AppBoundary } from "./AppBoundary";

const lazyPage = async <T extends { default: ComponentType }>(module: Promise<T>) => {
  const loaded = await module;
  return { Component: loaded.default };
};

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppBoundary,
    children: [
      { index: true, lazy: () => lazyPage(import("./page")) },
      { path: "analysis", lazy: () => lazyPage(import("./analysis/page")) },
      { path: "change-password", lazy: () => lazyPage(import("./change-password/page")) },
      { path: "integrations", lazy: () => lazyPage(import("./integrations/page")) },
      { path: "login", lazy: () => lazyPage(import("./login/page")) },
      { path: "member", lazy: () => lazyPage(import("./member/page")) },
      { path: "more", lazy: () => lazyPage(import("./more/page")) },
      { path: "purchase", lazy: () => lazyPage(import("./purchase/page")) },
      { path: "purchase/new", lazy: () => lazyPage(import("./purchase/new/page")) },
      { path: "sales", lazy: () => lazyPage(import("./sales/page")) },
      { path: "sales/new", lazy: () => lazyPage(import("./sales/new/page")) },
      { path: "settings", lazy: () => lazyPage(import("./settings/page")) },
      { path: "stock", lazy: () => lazyPage(import("./stock/page")) },
      { path: "stock/adjustment", lazy: () => lazyPage(import("./stock/adjustment/page")) },
      { path: "stock/discounts", lazy: () => lazyPage(import("./stock/discounts/page")) },
      { path: "stock/migration", lazy: () => lazyPage(import("./stock/migration/page")) },
      { path: "stock/min-max", lazy: () => lazyPage(import("./stock/min-max/page")) },
      { path: "*", Component: () => <Navigate to="/" replace /> },
    ],
  },
]);
