const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

export function recentSalesWeekRange(
  latestPaidSaleAt: Date | null,
  now = new Date(),
): { start: Date; end: Date } {
  const anchor = latestPaidSaleAt && latestPaidSaleAt.getTime() <= now.getTime()
    ? latestPaidSaleAt
    : now;
  const end = new Date(anchor.getTime());
  return {
    start: new Date(end.getTime() - WEEK_MS),
    end,
  };
}
