import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { encodeCode128B } from "@/lib/code128";
import {
  receiptPaymentMethodLabel,
  type ReceiptPaperSize,
  type ReceiptSnapshot,
} from "@/lib/receipt";

const POINTS_PER_MM = 72 / 25.4;
const MAX_ITEM_AREA_HEIGHT = 820;
const BLACK = rgb(0.06, 0.08, 0.07);
const MUTED = rgb(0.30, 0.34, 0.32);
const RULE = rgb(0.55, 0.58, 0.56);

type ReceiptFonts = { regular: PDFFont; bold: PDFFont };
type RowLayout = { nameLines: string[]; height: number; lineIndex: number };

function fontPath(filename: string): string {
  const base = process.env.NODE_ENV === "production" ? "dist" : "public";
  return path.resolve(process.cwd(), base, "fonts", "sarabun", filename);
}

async function loadReceiptFonts(document: PDFDocument): Promise<ReceiptFonts> {
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(fontPath("Sarabun-Regular.ttf")),
    readFile(fontPath("Sarabun-Bold.ttf")),
  ]);
  return {
    regular: await document.embedFont(regularBytes, { subset: true }),
    bold: await document.embedFont(boldBytes, { subset: true }),
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatReceiptDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const lines: string[] = [];
  let current = "";
  for (const character of [...normalized]) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current.trimEnd());
      current = character.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current.trimEnd());
  return lines;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number) {
  page.drawText(text, { x, y, font, size, color: BLACK });
}

function drawRight(page: PDFPage, text: string, right: number, y: number, font: PDFFont, size: number) {
  drawText(page, text, right - font.widthOfTextAtSize(text, size), y, font, size);
}

function drawCentered(page: PDFPage, text: string, width: number, y: number, font: PDFFont, size: number) {
  drawText(page, text, (width - font.widthOfTextAtSize(text, size)) / 2, y, font, size);
}

function drawCenteredWrapped(
  page: PDFPage,
  text: string,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => drawCentered(page, line, width, y - index * lineHeight, font, size));
  return y - lines.length * lineHeight;
}

function drawRule(page: PDFPage, left: number, right: number, y: number) {
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.45, color: RULE });
}

function drawBarcode(page: PDFPage, value: string, left: number, right: number, y: number, height: number) {
  const patterns = encodeCode128B(value);
  const modules = patterns.reduce(
    (total, pattern) => total + [...pattern].reduce((sum, digit) => sum + Number(digit), 0),
    20,
  );
  const moduleWidth = (right - left) / modules;
  let x = left + 10 * moduleWidth;
  patterns.forEach((pattern) => {
    [...pattern].forEach((digit, index) => {
      const width = Number(digit) * moduleWidth;
      if (index % 2 === 0) page.drawRectangle({ x, y, width, height, color: BLACK });
      x += width;
    });
  });
}

function tableMetrics(paper: ReceiptPaperSize, contentWidth: number) {
  const numberWidth = paper === "58" ? 10 : 12;
  const quantityWidth = paper === "58" ? 18 : 24;
  const unitWidth = paper === "58" ? 30 : 38;
  const totalWidth = paper === "58" ? 30 : 40;
  return {
    numberWidth,
    nameWidth: contentWidth - numberWidth - quantityWidth - unitWidth - totalWidth,
    quantityWidth,
    unitWidth,
    totalWidth,
  };
}

function makeRows(snapshot: ReceiptSnapshot, font: PDFFont, fontSize: number, nameWidth: number): RowLayout[] {
  return snapshot.lines.map((line, lineIndex) => {
    const nameLines = wrapText(line.itemName, font, fontSize, Math.max(nameWidth - 4, 18));
    return {
      nameLines,
      height: Math.max(16, nameLines.length * (fontSize + 2) + 7),
      lineIndex,
    };
  });
}

function chunkRows(rows: RowLayout[]): RowLayout[][] {
  const pages: RowLayout[][] = [];
  let current: RowLayout[] = [];
  let used = 0;
  rows.forEach((row) => {
    if (current.length > 0 && used + row.height > MAX_ITEM_AREA_HEIGHT) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += row.height;
  });
  if (current.length) pages.push(current);
  return pages;
}

function firstHeaderHeight(snapshot: ReceiptSnapshot, font: PDFFont, width: number, margin: number, size: number): number {
  const addressLines = wrapText(snapshot.store.address, font, size, width - margin * 2).length;
  return 122 + addressLines * (size + 2);
}

function finalSectionHeight(snapshot: ReceiptSnapshot): number {
  const totalRows = 6 + (snapshot.billDiscountAmount > 0 ? 1 : 0);
  const contactRows = [snapshot.store.lineId, snapshot.store.facebookPage, snapshot.store.email].filter(Boolean).length;
  return totalRows * 11 + contactRows * 10 + 150;
}

function drawFirstHeader(
  page: PDFPage,
  snapshot: ReceiptSnapshot,
  fonts: ReceiptFonts,
  width: number,
  margin: number,
  startY: number,
  bodySize: number,
): number {
  let y = startY;
  y = drawCenteredWrapped(page, snapshot.store.storeName, width, y, fonts.bold, bodySize + 4, width - margin * 2, bodySize + 6);
  y -= 2;
  y = drawCenteredWrapped(page, snapshot.store.address, width, y, fonts.regular, bodySize, width - margin * 2, bodySize + 2);
  drawCentered(page, `โทร. ${snapshot.store.phone}`, width, y, fonts.regular, bodySize);
  y -= bodySize + 8;
  drawCentered(page, "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ", width, y, fonts.bold, bodySize + 2);
  y -= bodySize + 5;
  drawCentered(page, `เลขประจำตัวผู้เสียภาษี ${snapshot.store.taxId}`, width, y, fonts.regular, bodySize);
  y -= bodySize + 6;
  drawRule(page, margin, width - margin, y);
  y -= 12;
  drawText(page, `เลขที่ใบเสร็จ ${snapshot.billNo}`, margin, y, fonts.regular, bodySize);
  y -= bodySize + 3;
  drawText(page, `วันที่ ${formatReceiptDateTime(snapshot.soldAt)}`, margin, y, fonts.regular, bodySize);
  y -= bodySize + 3;
  drawText(page, `ลูกค้า ${snapshot.customerName}`, margin, y, fonts.regular, bodySize);
  y -= bodySize + 3;
  drawText(page, `พนักงานขาย ${snapshot.salespersonName}`, margin, y, fonts.regular, bodySize);
  return y - bodySize - 5;
}

function drawContinuationHeader(
  page: PDFPage,
  snapshot: ReceiptSnapshot,
  fonts: ReceiptFonts,
  width: number,
  margin: number,
  startY: number,
  bodySize: number,
  pageNumber: number,
  pageCount: number,
): number {
  let y = startY;
  drawCentered(page, "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ", width, y, fonts.bold, bodySize + 2);
  y -= bodySize + 5;
  drawText(page, `เลขที่ ${snapshot.billNo}`, margin, y, fonts.regular, bodySize);
  drawRight(page, `หน้า ${pageNumber}/${pageCount}`, width - margin, y, fonts.regular, bodySize);
  y -= bodySize + 4;
  drawText(page, `วันที่ ${formatReceiptDateTime(snapshot.soldAt)}`, margin, y, fonts.regular, bodySize);
  y -= bodySize + 6;
  drawRule(page, margin, width - margin, y);
  return y - 10;
}

function drawTableHeader(
  page: PDFPage,
  fonts: ReceiptFonts,
  paper: ReceiptPaperSize,
  width: number,
  margin: number,
  y: number,
  size: number,
) {
  const contentWidth = width - margin * 2;
  const metrics = tableMetrics(paper, contentWidth);
  let x = margin;
  drawText(page, "#", x, y, fonts.bold, size);
  x += metrics.numberWidth;
  drawText(page, "ชื่อสินค้า", x, y, fonts.bold, size);
  x += metrics.nameWidth;
  drawRight(page, "จำนวน", x + metrics.quantityWidth, y, fonts.bold, size);
  x += metrics.quantityWidth;
  drawRight(page, "ราคา", x + metrics.unitWidth, y, fonts.bold, size);
  x += metrics.unitWidth;
  drawRight(page, "รวม", x + metrics.totalWidth, y, fonts.bold, size);
  return { y: y - size - 5, metrics };
}

function drawRows(
  page: PDFPage,
  snapshot: ReceiptSnapshot,
  rows: RowLayout[],
  fonts: ReceiptFonts,
  width: number,
  margin: number,
  startY: number,
  size: number,
  metrics: ReturnType<typeof tableMetrics>,
): number {
  let y = startY;
  rows.forEach((row) => {
    const line = snapshot.lines[row.lineIndex];
    let x = margin;
    drawText(page, String(row.lineIndex + 1), x, y, fonts.regular, size);
    x += metrics.numberWidth;
    row.nameLines.forEach((nameLine, index) => {
      drawText(page, nameLine, x, y - index * (size + 2), fonts.regular, size);
    });
    x += metrics.nameWidth;
    drawRight(page, String(line.quantity), x + metrics.quantityWidth, y, fonts.regular, size);
    x += metrics.quantityWidth;
    drawRight(page, formatMoney(line.unitPrice), x + metrics.unitWidth, y, fonts.regular, size);
    x += metrics.unitWidth;
    drawRight(page, formatMoney(line.lineTotal), x + metrics.totalWidth, y, fonts.regular, size);
    y -= row.height;
    drawRule(page, margin, width - margin, y + 8);
  });
  return y - 2;
}

function drawTotalsAndFooter(
  page: PDFPage,
  snapshot: ReceiptSnapshot,
  fonts: ReceiptFonts,
  width: number,
  margin: number,
  startY: number,
  bodySize: number,
) {
  let y = startY;
  const right = width - margin;
  const labelRight = right - (width < 200 ? 40 : 55);
  const totalRow = (label: string, value: number, bold = false) => {
    const font = bold ? fonts.bold : fonts.regular;
    drawRight(page, label, labelRight, y, font, bodySize);
    drawRight(page, formatMoney(value), right, y, font, bodySize);
    y -= 11;
  };

  totalRow("รวมเป็นเงิน", snapshot.itemSubtotal);
  if (snapshot.billDiscountAmount > 0) totalRow("ส่วนลดท้ายบิล", snapshot.billDiscountAmount);
  totalRow("มูลค่าก่อนภาษี", snapshot.vat.beforeVat);
  totalRow("ภาษีมูลค่าเพิ่ม 7%", snapshot.vat.vatAmount);
  totalRow("ยอดสุทธิ", snapshot.netTotal, true);
  totalRow("รับเงิน", snapshot.customerPaid);
  totalRow("เงินทอน", snapshot.changeDue);
  y -= 1;
  drawText(page, `วิธีชำระเงิน ${receiptPaymentMethodLabel(snapshot.paymentMethod)}`, margin, y, fonts.regular, bodySize);
  y -= bodySize + 7;
  drawRule(page, margin, right, y);
  y -= 15;
  drawCentered(page, "ขอบคุณที่ใช้บริการ", width, y, fonts.bold, bodySize + 2);
  y -= bodySize + 4;
  drawCentered(page, "เอกสารนี้เป็นหลักฐานการชำระเงิน", width, y, fonts.regular, bodySize);
  y -= bodySize + 5;
  drawCentered(
    page,
    `เปิดบริการทุกวัน ${snapshot.store.openingTime} - ${snapshot.store.closingTime} น.`,
    width,
    y,
    fonts.regular,
    bodySize,
  );
  y -= bodySize + 6;
  const contacts = [
    snapshot.store.lineId ? `LINE: ${snapshot.store.lineId}` : "",
    snapshot.store.facebookPage ? `Facebook: ${snapshot.store.facebookPage}` : "",
    snapshot.store.email ? `อีเมล: ${snapshot.store.email}` : "",
  ].filter(Boolean);
  contacts.forEach((contact) => {
    drawCentered(page, contact, width, y, fonts.regular, bodySize);
    y -= 10;
  });
  y -= 4;
  drawRule(page, margin, right, y);
  y -= 40;
  const barcodeValue = /^[\x20-\x7e]{1,100}$/.test(snapshot.billNo)
    ? snapshot.billNo
    : [...snapshot.saleId].filter((character) => /[\x20-\x7e]/.test(character)).join("").slice(0, 100) || "RECEIPT";
  drawBarcode(page, barcodeValue, margin + 4, right - 4, y, 32);
  y -= 14;
  drawCentered(page, snapshot.billNo, width, y, fonts.regular, bodySize + 1);
}

export async function generateReceiptPdf(
  snapshot: ReceiptSnapshot,
  paper: ReceiptPaperSize,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts = await loadReceiptFonts(document);
  const width = Number(paper) * POINTS_PER_MM;
  const margin = paper === "58" ? 9 : 11;
  const bodySize = paper === "58" ? 7.5 : 8.5;
  const itemSize = paper === "58" ? 7 : 8;
  const metrics = tableMetrics(paper, width - margin * 2);
  const chunks = chunkRows(makeRows(snapshot, fonts.regular, itemSize, metrics.nameWidth));
  const tableHeaderSize = paper === "58" ? 5.5 : itemSize;

  chunks.forEach((rows, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const headerHeight = isFirst
      ? firstHeaderHeight(snapshot, fonts.regular, width, margin, bodySize)
      : 62;
    const itemsHeight = rows.reduce((sum, row) => sum + row.height, 0);
    const footerHeight = isLast ? finalSectionHeight(snapshot) : 0;
    const height = Math.max(220, 24 + headerHeight + 24 + itemsHeight + footerHeight);
    const page = document.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    let y = height - 12;
    y = isFirst
      ? drawFirstHeader(page, snapshot, fonts, width, margin, y, bodySize)
      : drawContinuationHeader(page, snapshot, fonts, width, margin, y, bodySize, index + 1, chunks.length);
    const table = drawTableHeader(page, fonts, paper, width, margin, y, tableHeaderSize);
    drawRule(page, margin, width - margin, table.y + tableHeaderSize + 2);
    y = drawRows(page, snapshot, rows, fonts, width, margin, table.y, itemSize, table.metrics);
    if (isLast) drawTotalsAndFooter(page, snapshot, fonts, width, margin, y, bodySize);
  });

  document.setTitle(`ใบเสร็จรับเงิน ${snapshot.billNo}`);
  document.setAuthor(snapshot.store.storeName);
  document.setCreator("RxPro");
  document.setProducer("RxPro");
  return document.save();
}
