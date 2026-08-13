import {
  isAuthenticationError,
  requireAuthenticatedUser,
} from "@server/auth/pharmUser";
import { readSalesReport } from "@server/db/reports/salesReportRepository";
import { createSalesReportCsv } from "@server/db/reports/salesReportCsv";
import { readStoreProfile } from "@server/db/settings/storeProfileRepository";
import { generateSalesReportPdf } from "@server/db/reports/salesReportPdf";
import type { SalesReportResponse } from "@server/db/reports/salesReportModel";
import {
  parseSalesReportQuery,
  SalesReportPermissionError,
  SalesReportQueryError,
} from "@server/db/reports/salesReportModel";

export function createSalesReportResponse(
  report: SalesReportResponse,
  format: "csv" | "pdf" | null,
  pdf?: Uint8Array,
): Response {
  if (format === "csv") {
    const filename = `sales-${report.view}-${report.period.from}-${report.period.to}.csv`;
    return new Response(createSalesReportCsv(report), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    } });
  }
  if (format === "pdf" && pdf) {
    const filename = `sales-${report.view}-${report.period.from}-${report.period.to}.pdf`;
    return new Response(pdf as BodyInit, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "X-Content-Type-Options": "nosniff",
    } });
  }
  return Response.json(report);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const query = parseSalesReportQuery(url);
    const requestedFormat = url.searchParams.get("format");
    if (requestedFormat !== null && requestedFormat !== "csv" && requestedFormat !== "pdf") {
      throw new SalesReportQueryError("Sales report export format is invalid.");
    }
    const format = requestedFormat === "csv" || requestedFormat === "pdf" ? requestedFormat : null;
    const report = await readSalesReport(
      format ? { ...query, page: 1, pageSize: 10_000 } : query,
      user.role === "owner",
    );
    if (format === "pdf") {
      const profile = await readStoreProfile();
      return createSalesReportResponse(report, format, await generateSalesReportPdf(report, profile));
    }
    return createSalesReportResponse(report, format);
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof SalesReportPermissionError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SalesReportQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Unable to load the sales report." }, { status: 500 });
  }
}
