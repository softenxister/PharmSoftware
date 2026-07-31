const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

export function bangkokWeekRange(now = new Date()): { start: Date; end: Date } {
  const bangkokTime = new Date(now.getTime() + BANGKOK_UTC_OFFSET_MS);
  const daysSinceMonday = (bangkokTime.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(
    bangkokTime.getUTCFullYear(),
    bangkokTime.getUTCMonth(),
    bangkokTime.getUTCDate() - daysSinceMonday,
  ) - BANGKOK_UTC_OFFSET_MS);

  return {
    start,
    end: new Date(start.getTime() + WEEK_MS),
  };
}
