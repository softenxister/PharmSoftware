import type { SalesReportResponse } from "./salesReportModel";

type CsvValue = string | number | null;

function csvCell(value: CsvValue): string {
  if (value === null) return "";
  let text = typeof value === "number" ? String(value) : value;
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const money = (value: number | null) => value === null ? null : value.toFixed(2);
const row = (values: CsvValue[]) => values.map(csvCell).join(",");

export function createSalesReportCsv(report: SalesReportResponse): string {
  let headers: string[] = [];
  let rows: CsvValue[][] = [];

  if (report.view === "daily") {
    headers = ["Date", "Paid bills", "Items sold", "Product value", "Bill discount", "VAT", "Net collected", "Cost", "Gross difference", "Margin %"];
    rows = report.rows.flatMap((entry) => entry.type === "daily" ? [[
      entry.date,
      entry.paidBills,
      entry.itemsSold,
      money(entry.grossProductValue),
      money(entry.billDiscount),
      money(entry.vat),
      money(entry.netCollected),
      money(entry.cost),
      money(entry.grossDifference),
      money(entry.marginPercent),
    ]] : []);
  } else if (report.view === "bill-profit") {
    headers = ["Bill number", "Date and time", "Customer", "Payment", "Items sold", "Product value", "Bill discount", "VAT", "Net collected", "Cost", "Gross difference", "Margin %"];
    rows = report.rows.flatMap((entry) => entry.type === "bill-profit" ? [[
      entry.billNo,
      entry.soldAt,
      entry.customerName,
      entry.paymentMethod,
      entry.itemsSold,
      money(entry.grossProductValue),
      money(entry.billDiscount),
      money(entry.vat),
      money(entry.netCollected),
      money(entry.cost),
      money(entry.grossDifference),
      money(entry.marginPercent),
    ]] : []);
  } else if (report.view === "product-sales") {
    headers = ["Product code", "Product", "Pack / unit", "Quantity sold", "Paid bills", "Average sell price", "Product sales"];
    rows = report.rows.flatMap((entry) => entry.type === "product-sales" ? [[
      entry.productCode,
      entry.productName,
      entry.packLabel,
      entry.quantitySold,
      entry.paidBills,
      money(entry.averageSellPrice),
      money(entry.productSales),
    ]] : []);
  } else {
    headers = ["Product code", "Product", "Pack / unit", "Quantity sold", "Product sales", "Average unit cost", "Cost", "Gross difference", "Margin %", "Cost status"];
    rows = report.rows.flatMap((entry) => entry.type === "product-profit" ? [[
      entry.productCode,
      entry.productName,
      entry.packLabel,
      entry.quantitySold,
      money(entry.productSales),
      money(entry.averageUnitCost),
      money(entry.cost),
      money(entry.grossDifference),
      money(entry.marginPercent),
      entry.hasCompleteCost ? "Complete" : "Unavailable",
    ]] : []);
  }

  return `\uFEFF${[row(headers), ...rows.map(row)].join("\r\n")}\r\n`;
}
