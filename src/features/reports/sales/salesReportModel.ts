import type { AnalysisDefaultRange } from "@/config/preferences/appPreferences";
import type { SalesReportView } from "@server/db/reports/salesReportModel";

export type SalesReportRange = AnalysisDefaultRange | "custom";

export type SalesReportLocation = {
  view: SalesReportView;
  range: SalesReportRange;
  from: string;
  to: string;
  page: number;
};

const REPORT_VIEWS = new Set<SalesReportView>([
  "daily",
  "bill-profit",
  "product-sales",
  "product-profit",
]);
const PROFIT_VIEWS = new Set<SalesReportView>(["bill-profit", "product-profit"]);
const RANGE_VALUES = new Set<SalesReportRange>(["today", "7d", "30d", "custom"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function bangkokDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftBangkokDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return bangkokDate(date);
}

function presetPeriod(range: AnalysisDefaultRange, now: Date) {
  const to = bangkokDate(now);
  const offset = range === "today" ? 0 : range === "7d" ? -6 : -29;
  return { from: shiftBangkokDate(to, offset), to };
}

function validDate(value: string | null): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  return bangkokDate(new Date(`${value}T00:00:00+07:00`)) === value;
}

export function resolveSalesReportLocation(
  search: URLSearchParams,
  defaultRange: AnalysisDefaultRange,
  canViewProfit: boolean,
  now = new Date(),
): SalesReportLocation {
  const requestedView = search.get("view") as SalesReportView | null;
  const view = requestedView && REPORT_VIEWS.has(requestedView)
    && (canViewProfit || !PROFIT_VIEWS.has(requestedView))
    ? requestedView
    : "daily";
  const requestedRange = search.get("range") as SalesReportRange | null;
  const range = requestedRange && RANGE_VALUES.has(requestedRange) ? requestedRange : defaultRange;
  const preset = presetPeriod(range === "custom" ? defaultRange : range, now);
  const requestedFrom = search.get("from");
  const requestedTo = search.get("to");
  const hasValidCustomPeriod = range === "custom"
    && validDate(requestedFrom) && validDate(requestedTo) && requestedFrom <= requestedTo;
  const pageValue = Number(search.get("page") ?? 1);

  return {
    view,
    range,
    from: hasValidCustomPeriod ? requestedFrom : preset.from,
    to: hasValidCustomPeriod ? requestedTo : preset.to,
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}

export function reportSearchParams(location: SalesReportLocation): URLSearchParams {
  return new URLSearchParams({
    view: location.view,
    range: location.range,
    from: location.from,
    to: location.to,
    page: String(location.page),
  });
}

export function buildSalesReportRequestUrl(location: SalesReportLocation): string {
  const query = new URLSearchParams({
    view: location.view,
    from: location.from,
    to: location.to,
    page: String(location.page),
    pageSize: "50",
  });
  return `/api/reports/sales?${query.toString()}`;
}

export function periodForRange(range: AnalysisDefaultRange, now = new Date()) {
  return presetPeriod(range, now);
}

export const isProfitView = (view: SalesReportView) => PROFIT_VIEWS.has(view);
