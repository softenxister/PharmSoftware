import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import type { StoreProfile } from "@/config/preferences/storeProfile";
import type { SalesReportResponse, SalesReportRow } from "@server/db/reports/salesReportModel";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 40;
const CONTENT_WIDTH = A4_LANDSCAPE[0] - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const ROWS_PER_PAGE = 22;

type Fonts = { regular: PDFFont; bold: PDFFont };
type Alignment = "left" | "center" | "right";
type Column = {
  label: string;
  weight: number;
  align: Alignment;
  value: (row: SalesReportRow) => string;
  bold?: boolean;
};

function fontPath(filename: string): string {
  const base = process.env.NODE_ENV === "production" ? "dist" : "public";
  return path.resolve(process.cwd(), base, "fonts", "sarabun", filename);
}

async function loadFonts(document: PDFDocument): Promise<Fonts> {
  document.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    readFile(fontPath("Sarabun-Regular.ttf")),
    readFile(fontPath("Sarabun-Bold.ttf")),
  ]);
  return {
    regular: await document.embedFont(regular, { subset: true }),
    bold: await document.embedFont(bold, { subset: true }),
  };
}

const money = (value: number | null) => value === null
  ? "ไม่มีข้อมูล"
  : `฿${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 });
const percent = (value: number | null) => value === null ? "ไม่มีข้อมูล" : `${number(value)}%`;

function thaiDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${day} ${months[month - 1]} ${year + 543}`;
}

function thaiDateTime(value: string): string {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => datePart.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${Number(part("year")) + 543} ${part("hour")}:${part("minute")}`;
}

function paymentMethod(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "cash") return "เงินสด";
  if (normalized === "promptpay" || normalized === "prompt pay") return "พร้อมเพย์";
  if (normalized === "credit card" || normalized === "card") return "บัตรเครดิต";
  if (normalized === "bank transfer" || normalized === "transfer") return "โอนเงิน";
  return value;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number) {
  page.drawText(text, { x, y, font, size, color: BLACK });
}

function drawAligned(
  page: PDFPage,
  text: string,
  left: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  align: Alignment,
) {
  const measured = font.widthOfTextAtSize(text, size);
  const x = align === "right" ? left + width - measured - 4
    : align === "center" ? left + (width - measured) / 2
    : left + 4;
  drawText(page, text, Math.max(left + 2, x), y, font, size);
}

function fitText(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width - 8) return text;
  let fitted = text;
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}…`, size) > width - 8) fitted = fitted.slice(0, -1);
  return `${fitted}…`;
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number) {
  drawText(page, text, (A4_LANDSCAPE[0] - font.widthOfTextAtSize(text, size)) / 2, y, font, size);
}

function viewCopy(view: SalesReportResponse["view"]) {
  if (view === "daily") return {
    title: "รายงานยอดขายรายวัน",
    description: "สรุปยอดขายและกำไรแยกตามวัน เพื่อใช้ตรวจสอบยอดขาย ส่วนลด ภาษีมูลค่าเพิ่ม และต้นทุนรวมของแต่ละวัน",
    totalLabel: "ยอดรวมการขาย",
    totalKey: "netCollected" as const,
  };
  if (view === "bill-profit") return {
    title: "รายงานกำไร-ขาดทุนแยกตามบิล",
    description: "แสดงยอดขาย ต้นทุน และกำไรของบิลแต่ละใบ เพื่อใช้ตรวจสอบผลการขายตามช่วงวันที่ที่เลือก",
    totalLabel: "ยอดรวมการขาย",
    totalKey: "netCollected" as const,
  };
  if (view === "product-sales") return {
    title: "รายงานสรุปการขายสินค้า",
    description: "รวมยอดขายตามสินค้า เพื่อดูจำนวนที่ขาย จำนวนบิลที่เกี่ยวข้อง ราคาขายเฉลี่ย และยอดขายรวม",
    totalLabel: "ยอดรวมการขาย",
    totalKey: "productSales" as const,
  };
  return {
    title: "รายงานกำไร-ขาดทุนแยกตามสินค้า",
    description: "เปรียบเทียบยอดขายกับต้นทุนของสินค้าแต่ละรายการ เพื่อดูกำไร กำไรร้อยละ และความครบถ้วนของต้นทุน",
    totalLabel: "ยอดรวมการขาย",
    totalKey: "productSales" as const,
  };
}

function columnsFor(report: SalesReportResponse): Column[] {
  if (report.view === "daily") {
    const columns: Column[] = [
      { label: "วันที่", weight: 1.15, align: "left", value: (row) => row.type === "daily" ? thaiDate(row.date) : "" },
      { label: "บิล", weight: 0.65, align: "right", value: (row) => row.type === "daily" ? number(row.paidBills) : "" },
      { label: "จำนวนขาย", weight: 0.75, align: "right", value: (row) => row.type === "daily" ? number(row.itemsSold) : "" },
      { label: "มูลค่าสินค้า", weight: 1.25, align: "right", value: (row) => row.type === "daily" ? money(row.grossProductValue) : "" },
      { label: "ส่วนลดท้ายบิล", weight: 1.15, align: "right", value: (row) => row.type === "daily" ? money(row.billDiscount) : "" },
      { label: "ภาษีมูลค่าเพิ่ม", weight: 1.1, align: "right", value: (row) => row.type === "daily" ? money(row.vat) : "" },
      { label: "ยอดรับจริง", weight: 1.3, align: "right", bold: true, value: (row) => row.type === "daily" ? money(row.netCollected) : "" },
    ];
    if (report.canViewProfit) columns.push(
      { label: "ต้นทุน", weight: 1.2, align: "right", value: (row) => row.type === "daily" ? money(row.cost) : "" },
      { label: "กำไร", weight: 1.2, align: "right", bold: true, value: (row) => row.type === "daily" ? money(row.grossDifference) : "" },
      { label: "กำไรร้อยละ", weight: 0.95, align: "right", value: (row) => row.type === "daily" ? percent(row.marginPercent) : "" },
    );
    return columns;
  }
  if (report.view === "bill-profit") return [
    { label: "เลขที่บิล", weight: 1.35, align: "left", value: (row) => row.type === "bill-profit" ? row.billNo : "" },
    { label: "วันและเวลา", weight: 1.1, align: "center", value: (row) => row.type === "bill-profit" ? thaiDateTime(row.soldAt) : "" },
    { label: "ลูกค้า", weight: 1.15, align: "left", value: (row) => row.type === "bill-profit" ? row.customerName : "" },
    { label: "การชำระเงิน", weight: 0.9, align: "center", value: (row) => row.type === "bill-profit" ? paymentMethod(row.paymentMethod) : "" },
    { label: "มูลค่าสินค้า", weight: 1.05, align: "right", value: (row) => row.type === "bill-profit" ? money(row.grossProductValue) : "" },
    { label: "ส่วนลดท้ายบิล", weight: 1, align: "right", value: (row) => row.type === "bill-profit" ? money(row.billDiscount) : "" },
    { label: "ยอดรับจริง", weight: 1.05, align: "right", bold: true, value: (row) => row.type === "bill-profit" ? money(row.netCollected) : "" },
    { label: "ต้นทุน", weight: 0.95, align: "right", value: (row) => row.type === "bill-profit" ? money(row.cost) : "" },
    { label: "กำไร", weight: 0.95, align: "right", bold: true, value: (row) => row.type === "bill-profit" ? money(row.grossDifference) : "" },
    { label: "กำไรร้อยละ", weight: 0.8, align: "right", value: (row) => row.type === "bill-profit" ? percent(row.marginPercent) : "" },
  ];
  if (report.view === "product-sales") return [
    { label: "รหัสสินค้า", weight: 1, align: "left", value: (row) => row.type === "product-sales" ? row.productCode : "" },
    { label: "ชื่อสินค้า", weight: 2.7, align: "left", value: (row) => row.type === "product-sales" ? row.productName : "" },
    { label: "แพ็ก / หน่วย", weight: 1.15, align: "center", value: (row) => row.type === "product-sales" ? row.packLabel : "" },
    { label: "จำนวนที่ขาย", weight: 1, align: "right", value: (row) => row.type === "product-sales" ? number(row.quantitySold) : "" },
    { label: "จำนวนบิล", weight: 0.9, align: "right", value: (row) => row.type === "product-sales" ? number(row.paidBills) : "" },
    { label: "ราคาขายเฉลี่ย", weight: 1.2, align: "right", value: (row) => row.type === "product-sales" ? money(row.averageSellPrice) : "" },
    { label: "ยอดขายสินค้า", weight: 1.3, align: "right", bold: true, value: (row) => row.type === "product-sales" ? money(row.productSales) : "" },
  ];
  return [
    { label: "รหัสสินค้า", weight: 0.95, align: "left", value: (row) => row.type === "product-profit" ? row.productCode : "" },
    { label: "ชื่อสินค้า", weight: 2.15, align: "left", value: (row) => row.type === "product-profit" ? row.productName : "" },
    { label: "แพ็ก / หน่วย", weight: 0.95, align: "center", value: (row) => row.type === "product-profit" ? row.packLabel : "" },
    { label: "จำนวน", weight: 0.65, align: "right", value: (row) => row.type === "product-profit" ? number(row.quantitySold) : "" },
    { label: "ยอดขาย", weight: 1, align: "right", value: (row) => row.type === "product-profit" ? money(row.productSales) : "" },
    { label: "ต้นทุนเฉลี่ย", weight: 1, align: "right", value: (row) => row.type === "product-profit" ? money(row.averageUnitCost) : "" },
    { label: "ต้นทุนรวม", weight: 1, align: "right", value: (row) => row.type === "product-profit" ? money(row.cost) : "" },
    { label: "กำไร", weight: 1, align: "right", bold: true, value: (row) => row.type === "product-profit" ? money(row.grossDifference) : "" },
    { label: "กำไรร้อยละ", weight: 0.85, align: "right", value: (row) => row.type === "product-profit" ? percent(row.marginPercent) : "" },
    { label: "สถานะต้นทุน", weight: 0.95, align: "center", value: (row) => row.type === "product-profit" ? (row.hasCompleteCost ? "ครบ" : "ไม่มีต้นทุน") : "" },
  ];
}

function drawHeader(page: PDFPage, report: SalesReportResponse, profile: StoreProfile, fonts: Fonts, generatedAt: Date) {
  const copy = viewCopy(report.view);
  centered(page, copy.title, 535, fonts.bold, 17);
  centered(page, profile.storeName, 512, fonts.regular, 9);
  if (profile.address) centered(page, profile.address, 499, fonts.regular, 8);
  const contacts = [profile.phone ? `โทรศัพท์ ${profile.phone}` : "", profile.taxId ? `เลขประจำตัวผู้เสียภาษี ${profile.taxId}` : ""].filter(Boolean).join("   ");
  if (contacts) centered(page, contacts, 487, fonts.regular, 8);
  centered(page, `ช่วงวันที่ ${thaiDate(report.period.from)} - ${thaiDate(report.period.to)}`, 469, fonts.regular, 8);
  centered(page, `จัดทำเมื่อ ${thaiDateTime(generatedAt.toISOString())}`, 457, fonts.regular, 8);

  const labelWidth = 86;
  const boxTop = 437;
  const rowHeight = 24;
  const rows = [
    ["รายละเอียดรายงาน", copy.description],
    ["เงื่อนไขข้อมูล", "ใช้ราคาที่บันทึกรวมภาษีมูลค่าเพิ่ม 7% และแสดงเฉพาะบิลที่ชำระแล้วในช่วงวันที่ที่เลือก"],
    ["ที่มาข้อมูลร้าน", "ชื่อร้าน ที่อยู่ โทรศัพท์ และเลขประจำตัวผู้เสียภาษีอ่านจาก การตั้งค่า > ข้อมูลร้าน ณ เวลาส่งออก"],
  ];
  rows.forEach(([label, value], index) => {
    const y = boxTop - index * rowHeight;
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, borderColor: GRAY, borderWidth: 0.5 });
    page.drawLine({ start: { x: MARGIN + labelWidth, y: y - rowHeight }, end: { x: MARGIN + labelWidth, y }, thickness: 0.5, color: GRAY });
    drawText(page, label, MARGIN + 7, y - 15, fonts.bold, 7.5);
    drawText(page, value, MARGIN + labelWidth + 7, y - 15, fonts.regular, 7.5);
  });
  const total = report.metrics.find((metric) => metric.key === copy.totalKey)?.value ?? 0;
  drawText(page, `${copy.totalLabel}: ${money(total)}`, MARGIN, 345, fonts.bold, 12);
}

function drawTable(page: PDFPage, report: SalesReportResponse, rows: SalesReportRow[], fonts: Fonts, pageNumber: number, pageCount: number) {
  const columns = columnsFor(report);
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = columns.map((column) => CONTENT_WIDTH * column.weight / totalWeight);
  const top = pageNumber === 1 ? 315 : 530;
  const rowHeight = 18;
  const sectionTitle = report.view === "daily" ? "รายละเอียดรายวัน"
    : report.view === "bill-profit" ? "รายละเอียดบิล"
    : report.view === "product-sales" ? "รายละเอียดสินค้า"
    : "รายละเอียดกำไร-ขาดทุนสินค้า";
  drawText(page, sectionTitle, MARGIN, top + 14, fonts.bold, 10);
  drawText(page, `จำนวน ${report.pagination.totalItems} รายการ`, A4_LANDSCAPE[0] - MARGIN - 64, top + 14, fonts.regular, 7);
  let x = MARGIN;
  columns.forEach((column, index) => {
    page.drawRectangle({ x, y: top - rowHeight, width: widths[index], height: rowHeight, color: LIGHT_GRAY, borderColor: GRAY, borderWidth: 0.45 });
    drawAligned(page, column.label, x, widths[index], top - 12, fonts.bold, 6.5, "center");
    x += widths[index];
  });
  rows.forEach((row, rowIndex) => {
    const y = top - (rowIndex + 2) * rowHeight;
    x = MARGIN;
    columns.forEach((column, index) => {
      page.drawRectangle({ x, y, width: widths[index], height: rowHeight, borderColor: GRAY, borderWidth: 0.35 });
      const font = column.bold ? fonts.bold : fonts.regular;
      const text = fitText(column.value(row), font, 6.5, widths[index]);
      drawAligned(page, text, x, widths[index], y + 6, font, 6.5, column.align);
      x += widths[index];
    });
  });
  drawText(page, `หน้า ${pageNumber} จาก ${pageCount}`, A4_LANDSCAPE[0] - MARGIN - 44, 22, fonts.regular, 7);
}

export async function generateSalesReportPdf(
  report: SalesReportResponse,
  profile: StoreProfile,
  generatedAt = new Date(),
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts = await loadFonts(document);
  const chunks = report.rows.length === 0
    ? [[]]
    : Array.from({ length: Math.ceil(report.rows.length / ROWS_PER_PAGE) }, (_, index) => (
      report.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)
    ));
  chunks.forEach((rows, index) => {
    const page = document.addPage(A4_LANDSCAPE);
    if (index === 0) drawHeader(page, report, profile, fonts, generatedAt);
    else centered(page, viewCopy(report.view).title, 555, fonts.bold, 13);
    drawTable(page, report, rows, fonts, index + 1, chunks.length);
    drawText(page, profile.storeName, MARGIN, 22, fonts.regular, 7);
  });
  document.setTitle(viewCopy(report.view).title);
  document.setAuthor(profile.storeName);
  document.setSubject("รายงานการขาย");
  return document.save();
}
