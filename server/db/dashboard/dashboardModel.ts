const BANGKOK_OFFSET = "+07:00";
const DAY_MS = 86_400_000;
const FALLBACK_OPENING_HOUR = 8;
const FALLBACK_CLOSING_HOUR = 20;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type DashboardSalesRecord = {
  netTotal: number;
  isMember: boolean;
};

export type DashboardHourlyTotal = {
  hour: number;
  total: number;
};

export type DashboardHourlyPoint = {
  hour: string;
  today: number | null;
  yesterday: number;
};

export type DashboardInventoryAlert = {
  productId: string;
  name: string;
  reason: "expired";
  availableStock: number;
  expiryDate: string;
  imageUrl: string;
};

export type DashboardRecentSale = {
  id: string;
  billNo: string;
  soldAt: string;
  customerName: string;
  netTotal: number;
  status: "paid" | "pending";
};

export type DashboardResponse = {
  generatedAt: string;
  date: string;
  store: {
    name: string;
    openingTime: string;
    closingTime: string;
    isOpen: boolean | null;
  };
  today: {
    netSales: number;
    netPurchases: number;
    paidBills: number;
    memberBills: number;
    averageBill: number | null;
    netSalesChangePercent: number | null;
    averageBillChangePercent: number | null;
  };
  inventory: {
    outOfStock: number;
    lowStock: number;
    expiringWithin30Days: number;
    items: DashboardInventoryAlert[];
  };
  hourlySales: DashboardHourlyPoint[];
  recentSales: DashboardRecentSale[];
  ownerFinancials?: {
    grossDifference: number | null;
    marginPercent: number | null;
    pricedLines: number;
    totalLines: number;
  };
};

function bangkokDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((entry) => entry.type === type)?.value ?? ""
  );
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function bangkokHour(value: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value).find((entry) => entry.type === "hour")?.value;
  return Number(hour ?? 0);
}

export function buildDashboardPeriod(now = new Date()) {
  const date = bangkokDate(now);
  const todayStart = new Date(`${date}T00:00:00${BANGKOK_OFFSET}`);
  const todayEndExclusive = new Date(todayStart.getTime() + DAY_MS);
  const todayEnd = new Date(Math.min(
    Math.max(now.getTime(), todayStart.getTime()),
    todayEndExclusive.getTime(),
  ));
  const elapsed = todayEnd.getTime() - todayStart.getTime();
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  return {
    date,
    todayStart,
    todayEnd,
    todayEndExclusive,
    yesterdayStart,
    yesterdayEnd: new Date(yesterdayStart.getTime() + elapsed),
  };
}

export function buildTimelineHours(openingTime: string, closingTime: string): string[] {
  const valid = TIME_PATTERN.test(openingTime) && TIME_PATTERN.test(closingTime);
  const openingHour = valid ? Number(openingTime.slice(0, 2)) : FALLBACK_OPENING_HOUR;
  const closingHour = valid ? Number(closingTime.slice(0, 2)) : FALLBACK_CLOSING_HOUR;
  const start = closingHour > openingHour ? openingHour : FALLBACK_OPENING_HOUR;
  const end = closingHour > openingHour ? closingHour : FALLBACK_CLOSING_HOUR;
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${String(start + index).padStart(2, "0")}:00`,
  );
}

export function summarizeDashboardSales(records: DashboardSalesRecord[]) {
  const netSales = Math.round(
    (records.reduce((sum, sale) => sum + sale.netTotal, 0) + Number.EPSILON) * 100,
  ) / 100;
  const paidBills = records.length;
  return {
    netSales,
    paidBills,
    memberBills: records.filter((sale) => sale.isMember).length,
    averageBill: paidBills > 0
      ? Math.round(((netSales / paidBills) + Number.EPSILON) * 100) / 100
      : null,
  };
}

export function comparisonPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round((((current - previous) / previous) * 100 + Number.EPSILON) * 10) / 10;
}

export function buildHourlySales(
  timeline: string[],
  today: DashboardHourlyTotal[],
  yesterday: DashboardHourlyTotal[],
  currentHour: number,
): DashboardHourlyPoint[] {
  const todayByHour = new Map(today.map((entry) => [entry.hour, entry.total]));
  const yesterdayByHour = new Map(yesterday.map((entry) => [entry.hour, entry.total]));
  return timeline.map((label) => {
    const hour = Number(label.slice(0, 2));
    return {
      hour: label,
      today: hour <= currentHour ? todayByHour.get(hour) ?? 0 : null,
      yesterday: yesterdayByHour.get(hour) ?? 0,
    };
  });
}

export function storeIsOpen(
  openingTime: string,
  closingTime: string,
  now = new Date(),
): boolean | null {
  if (!TIME_PATTERN.test(openingTime) || !TIME_PATTERN.test(closingTime)) return null;
  const openingMinutes = Number(openingTime.slice(0, 2)) * 60 + Number(openingTime.slice(3));
  const closingMinutes = Number(closingTime.slice(0, 2)) * 60 + Number(closingTime.slice(3));
  if (closingMinutes <= openingMinutes) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(
    parts.find((entry) => entry.type === type)?.value ?? 0,
  );
  const currentMinutes = part("hour") * 60 + part("minute");
  return currentMinutes >= openingMinutes && currentMinutes < closingMinutes;
}
