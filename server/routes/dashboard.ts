import {
  isAuthenticationError,
  requireAuthenticatedUser,
} from "@server/auth/pharmUser";
import type { DashboardResponse } from "@server/db/dashboard/dashboardModel";
import { readDashboard } from "@server/db/dashboard/dashboardRepository";

export function createDashboardResponse(dashboard: DashboardResponse): Response {
  return Response.json(dashboard, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return createDashboardResponse(await readDashboard(user.role === "owner"));
  } catch (error) {
    if (isAuthenticationError(error)) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Unable to load the dashboard." }, { status: 500 });
  }
}
