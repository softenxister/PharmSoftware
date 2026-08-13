import {
  isAuthenticationError,
  requireAuthenticatedUser,
} from "@server/auth/pharmUser";
import { readSalesReport } from "@server/db/reports/salesReportRepository";
import {
  parseSalesReportQuery,
  SalesReportPermissionError,
  SalesReportQueryError,
} from "@server/db/reports/salesReportModel";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const query = parseSalesReportQuery(new URL(request.url));
    return Response.json(await readSalesReport(query, user.role === "owner"));
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
