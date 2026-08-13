export const SALES_REPORT_VIEWS = [
  "daily",
  "bill-profit",
  "product-sales",
  "product-profit",
] as const;

export type SalesReportView = typeof SALES_REPORT_VIEWS[number];

export type SalesReportQuery = {
  view: SalesReportView;
  from: string;
  to: string;
  page: number;
  pageSize: number;
};

export type SalesReportSourceLine = {
  productId: string;
  productCode: string;
  itemName: string;
  packLabel: string;
  quantity: number;
  productSales: number;
  unitCost: number | null;
  costSource: "snapshot" | "unavailable";
};

export type SalesReportSourceSale = {
  id: string;
  billNo: string;
  soldAt: string;
  customerName: string;
  paymentMethod: string;
  status: "paid" | "pending" | "void";
  itemSubtotal: number;
  billDiscountAmount: number;
  netCollected: number;
  vatAmount: number;
  lines: SalesReportSourceLine[];
};

export type DailySalesReportRow = {
  type: "daily";
  date: string;
  paidBills: number;
  itemsSold: number;
  grossProductValue: number;
  billDiscount: number;
  vat: number;
  netCollected: number;
  cost: number | null;
  grossDifference: number | null;
  marginPercent: number | null;
  hasCompleteCost: boolean;
};

export type BillProfitReportRow = {
  type: "bill-profit";
  saleId: string;
  billNo: string;
  soldAt: string;
  customerName: string;
  paymentMethod: string;
  itemsSold: number;
  grossProductValue: number;
  billDiscount: number;
  vat: number;
  netCollected: number;
  cost: number | null;
  grossDifference: number | null;
  marginPercent: number | null;
  hasCompleteCost: boolean;
  lines: SalesReportSourceLine[];
};

export type ProductSalesReportRow = {
  type: "product-sales";
  productId: string;
  productCode: string;
  productName: string;
  packLabel: string;
  quantitySold: number;
  paidBills: number;
  averageSellPrice: number;
  productSales: number;
};

export type ProductProfitReportRow = {
  type: "product-profit";
  productId: string;
  productCode: string;
  productName: string;
  packLabel: string;
  quantitySold: number;
  productSales: number;
  averageUnitCost: number | null;
  cost: number | null;
  grossDifference: number | null;
  marginPercent: number | null;
  hasCompleteCost: boolean;
};

export type SalesReportRow =
  | DailySalesReportRow
  | BillProfitReportRow
  | ProductSalesReportRow
  | ProductProfitReportRow;

export type SalesReportMetricKey =
  | "netCollected"
  | "billDiscount"
  | "vat"
  | "cost"
  | "grossDifference"
  | "marginPercent"
  | "paidBills"
  | "productSales"
  | "quantitySold"
  | "uniqueProducts";

export type SalesReportMetric = {
  key: SalesReportMetricKey;
  value: number | null;
  format: "money" | "number" | "percent";
};

export type SalesReportResponse = {
  view: SalesReportView;
  period: { from: string; to: string };
  canViewProfit: boolean;
  taxBasis: "inclusive-7";
  metrics: SalesReportMetric[];
  rows: SalesReportRow[];
  costCoverage: { pricedLines: number; totalLines: number };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export class SalesReportQueryError extends Error {}
export class SalesReportPermissionError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_OFFSET = "+07:00";

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00${BANGKOK_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return false;
  return bangkokDate(parsed) === value;
}

function bangkokDate(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00${BANGKOK_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + days);
  return bangkokDate(date);
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new SalesReportQueryError("Report pagination is invalid.");
  return Math.min(parsed, maximum);
}

export function parseSalesReportQuery(url: URL, now = new Date()): SalesReportQuery {
  const requestedView = url.searchParams.get("view") ?? "daily";
  if (!SALES_REPORT_VIEWS.includes(requestedView as SalesReportView)) {
    throw new SalesReportQueryError("Sales report view is invalid.");
  }
  const today = bangkokDate(now);
  const from = url.searchParams.get("from") ?? shiftDate(today, -29);
  const to = url.searchParams.get("to") ?? today;
  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    throw new SalesReportQueryError("Sales report date range is invalid.");
  }
  const start = new Date(`${from}T00:00:00${BANGKOK_OFFSET}`).getTime();
  const end = new Date(`${to}T00:00:00${BANGKOK_OFFSET}`).getTime();
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days < 1 || days > 366) throw new SalesReportQueryError("Sales report date range must be between 1 and 366 days.");

  return {
    view: requestedView as SalesReportView,
    from,
    to,
    page: positiveInteger(url.searchParams.get("page"), 1, 10_000),
    pageSize: positiveInteger(url.searchParams.get("pageSize"), 50, 100),
  };
}

export function salesReportDateBounds(query: Pick<SalesReportQuery, "from" | "to">) {
  return {
    start: new Date(`${query.from}T00:00:00${BANGKOK_OFFSET}`),
    endExclusive: new Date(`${shiftDate(query.to, 1)}T00:00:00${BANGKOK_OFFSET}`),
  };
}

function lineCost(line: SalesReportSourceLine): number | null {
  return line.unitCost === null ? null : roundCurrency(line.unitCost * line.quantity);
}

function saleCost(sale: SalesReportSourceSale): number | null {
  if (sale.lines.some((line) => lineCost(line) === null)) return null;
  return roundCurrency(sale.lines.reduce((sum, line) => sum + (lineCost(line) ?? 0), 0));
}

function differenceAndMargin(value: number, cost: number | null) {
  if (cost === null) return { grossDifference: null, marginPercent: null };
  const grossDifference = roundCurrency(value - cost);
  return {
    grossDifference,
    marginPercent: value > 0 ? roundCurrency((grossDifference / value) * 100) : null,
  };
}

function paidSalesInPeriod(sales: SalesReportSourceSale[], query: SalesReportQuery) {
  return sales.filter((sale) => {
    if (sale.status !== "paid") return false;
    const date = bangkokDate(sale.soldAt);
    return date >= query.from && date <= query.to;
  });
}

function dailyRows(sales: SalesReportSourceSale[], canViewProfit: boolean): DailySalesReportRow[] {
  const grouped = new Map<string, SalesReportSourceSale[]>();
  for (const sale of sales) {
    const date = bangkokDate(sale.soldAt);
    grouped.set(date, [...(grouped.get(date) ?? []), sale]);
  }
  return [...grouped.entries()].map(([date, daySales]): DailySalesReportRow => {
    const costValues = daySales.map(saleCost);
    const hasCompleteCost = canViewProfit && costValues.every((cost) => cost !== null);
    const cost = hasCompleteCost
      ? roundCurrency(costValues.reduce<number>((sum, value) => sum + (value ?? 0), 0))
      : null;
    const netCollected = roundCurrency(daySales.reduce((sum, sale) => sum + sale.netCollected, 0));
    return {
      type: "daily",
      date,
      paidBills: daySales.length,
      itemsSold: roundQuantity(daySales.reduce((sum, sale) => (
        sum + sale.lines.reduce((lineSum, line) => lineSum + line.quantity, 0)
      ), 0)),
      grossProductValue: roundCurrency(daySales.reduce((sum, sale) => sum + sale.itemSubtotal, 0)),
      billDiscount: roundCurrency(daySales.reduce((sum, sale) => sum + sale.billDiscountAmount, 0)),
      vat: roundCurrency(daySales.reduce((sum, sale) => sum + sale.vatAmount, 0)),
      netCollected,
      cost,
      ...differenceAndMargin(netCollected, cost),
      hasCompleteCost,
    };
  }).sort((first, second) => second.date.localeCompare(first.date));
}

function billRows(sales: SalesReportSourceSale[]): BillProfitReportRow[] {
  return sales.map((sale): BillProfitReportRow => {
    const cost = saleCost(sale);
    return {
      type: "bill-profit",
      saleId: sale.id,
      billNo: sale.billNo,
      soldAt: sale.soldAt,
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      itemsSold: roundQuantity(sale.lines.reduce((sum, line) => sum + line.quantity, 0)),
      grossProductValue: roundCurrency(sale.itemSubtotal),
      billDiscount: roundCurrency(sale.billDiscountAmount),
      vat: roundCurrency(sale.vatAmount),
      netCollected: roundCurrency(sale.netCollected),
      cost,
      ...differenceAndMargin(sale.netCollected, cost),
      hasCompleteCost: cost !== null,
      lines: sale.lines,
    };
  }).sort((first, second) => second.soldAt.localeCompare(first.soldAt));
}

type ProductAggregate = {
  productId: string;
  productCode: string;
  productName: string;
  packLabel: string;
  quantitySold: number;
  productSales: number;
  saleIds: Set<string>;
  cost: number;
  hasCompleteCost: boolean;
};

function productAggregates(sales: SalesReportSourceSale[]): ProductAggregate[] {
  const grouped = new Map<string, ProductAggregate>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const key = `${line.productId}\u0000${line.packLabel}`;
      const aggregate = grouped.get(key) ?? {
        productId: line.productId,
        productCode: line.productCode,
        productName: line.itemName,
        packLabel: line.packLabel,
        quantitySold: 0,
        productSales: 0,
        saleIds: new Set<string>(),
        cost: 0,
        hasCompleteCost: true,
      };
      aggregate.quantitySold += line.quantity;
      aggregate.productSales += line.productSales;
      aggregate.saleIds.add(sale.id);
      const cost = lineCost(line);
      if (cost === null) aggregate.hasCompleteCost = false;
      else aggregate.cost += cost;
      grouped.set(key, aggregate);
    }
  }
  return [...grouped.values()].sort((first, second) => (
    second.productSales - first.productSales || first.productName.localeCompare(second.productName)
  ));
}

function productSalesRows(sales: SalesReportSourceSale[]): ProductSalesReportRow[] {
  return productAggregates(sales).map((product) => ({
    type: "product-sales",
    productId: product.productId,
    productCode: product.productCode,
    productName: product.productName,
    packLabel: product.packLabel,
    quantitySold: roundQuantity(product.quantitySold),
    paidBills: product.saleIds.size,
    averageSellPrice: product.quantitySold > 0
      ? roundCurrency(product.productSales / product.quantitySold)
      : 0,
    productSales: roundCurrency(product.productSales),
  }));
}

function productProfitRows(sales: SalesReportSourceSale[]): ProductProfitReportRow[] {
  return productAggregates(sales).map((product) => {
    const cost = product.hasCompleteCost ? roundCurrency(product.cost) : null;
    return {
      type: "product-profit",
      productId: product.productId,
      productCode: product.productCode,
      productName: product.productName,
      packLabel: product.packLabel,
      quantitySold: roundQuantity(product.quantitySold),
      productSales: roundCurrency(product.productSales),
      averageUnitCost: cost !== null && product.quantitySold > 0
        ? roundCurrency(cost / product.quantitySold)
        : null,
      cost,
      ...differenceAndMargin(product.productSales, cost),
      hasCompleteCost: product.hasCompleteCost,
    };
  });
}

function metricsFor(view: SalesReportView, sales: SalesReportSourceSale[], rows: SalesReportRow[], canViewProfit: boolean): SalesReportMetric[] {
  const netCollected = roundCurrency(sales.reduce((sum, sale) => sum + sale.netCollected, 0));
  const billDiscount = roundCurrency(sales.reduce((sum, sale) => sum + sale.billDiscountAmount, 0));
  const vat = roundCurrency(sales.reduce((sum, sale) => sum + sale.vatAmount, 0));
  const allCosts = sales.map(saleCost);
  const cost = canViewProfit && allCosts.every((value) => value !== null)
    ? roundCurrency(allCosts.reduce<number>((sum, value) => sum + (value ?? 0), 0))
    : null;
  const difference = differenceAndMargin(netCollected, cost);
  const productSales = roundCurrency(sales.reduce((sum, sale) => sum + sale.itemSubtotal, 0));
  const quantitySold = roundQuantity(sales.reduce((sum, sale) => (
    sum + sale.lines.reduce((lineSum, line) => lineSum + line.quantity, 0)
  ), 0));
  const uniqueProducts = new Set(sales.flatMap((sale) => sale.lines.map((line) => line.productId))).size;

  if (view === "daily") return [
    { key: "netCollected", value: netCollected, format: "money" },
    { key: "billDiscount", value: billDiscount, format: "money" },
    { key: "vat", value: vat, format: "money" },
    canViewProfit
      ? { key: "grossDifference", value: difference.grossDifference, format: "money" }
      : { key: "paidBills", value: sales.length, format: "number" },
  ];
  if (view === "bill-profit") return [
    { key: "paidBills", value: sales.length, format: "number" },
    { key: "netCollected", value: netCollected, format: "money" },
    { key: "cost", value: cost, format: "money" },
    { key: "grossDifference", value: difference.grossDifference, format: "money" },
  ];
  if (view === "product-sales") return [
    { key: "productSales", value: productSales, format: "money" },
    { key: "quantitySold", value: quantitySold, format: "number" },
    { key: "uniqueProducts", value: uniqueProducts, format: "number" },
    { key: "paidBills", value: sales.length, format: "number" },
  ];
  const productCostValues = rows.flatMap((row) => row.type === "product-profit" ? [row.cost] : []);
  const productCost = productCostValues.every((value) => value !== null)
    ? roundCurrency(productCostValues.reduce<number>((sum, value) => sum + (value ?? 0), 0))
    : null;
  const productDifference = differenceAndMargin(productSales, productCost);
  return [
    { key: "productSales", value: productSales, format: "money" },
    { key: "cost", value: productCost, format: "money" },
    { key: "grossDifference", value: productDifference.grossDifference, format: "money" },
    { key: "marginPercent", value: productDifference.marginPercent, format: "percent" },
  ];
}

export function buildSalesReport(
  sourceSales: SalesReportSourceSale[],
  query: SalesReportQuery,
  canViewProfit: boolean,
): SalesReportResponse {
  if (!canViewProfit && (query.view === "bill-profit" || query.view === "product-profit")) {
    throw new SalesReportPermissionError("Profit report permission denied.");
  }
  const sales = paidSalesInPeriod(sourceSales, query);
  const allRows: SalesReportRow[] = query.view === "daily"
    ? dailyRows(sales, canViewProfit)
    : query.view === "bill-profit"
      ? billRows(sales)
      : query.view === "product-sales"
        ? productSalesRows(sales)
        : productProfitRows(sales);
  const offset = (query.page - 1) * query.pageSize;
  const totalPages = Math.max(Math.ceil(allRows.length / query.pageSize), 1);
  const totalLines = sales.reduce((sum, sale) => sum + sale.lines.length, 0);
  const pricedLines = sales.reduce((sum, sale) => (
    sum + sale.lines.filter((line) => line.unitCost !== null).length
  ), 0);

  return {
    view: query.view,
    period: { from: query.from, to: query.to },
    canViewProfit,
    taxBasis: "inclusive-7",
    metrics: metricsFor(query.view, sales, allRows, canViewProfit),
    rows: allRows.slice(offset, offset + query.pageSize),
    costCoverage: { pricedLines, totalLines },
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: allRows.length,
      totalPages,
    },
  };
}
