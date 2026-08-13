import type { SalesReportResponse } from "@server/db/reports/salesReportModel";
import { buildSalesReportRequestUrl, type SalesReportLocation } from "./salesReportModel";

export async function loadSalesReport(
  location: SalesReportLocation,
  signal?: AbortSignal,
): Promise<SalesReportResponse> {
  const response = await fetch(buildSalesReportRequestUrl(location), {
    cache: "no-store",
    signal,
  });
  const body = await response.json() as SalesReportResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "Unable to load the sales report.");
  return body;
}

export function reportExportUrl(location: SalesReportLocation, format: "csv" | "pdf"): string {
  return `${buildSalesReportRequestUrl({ ...location, page: 1 })}&format=${format}`;
}
