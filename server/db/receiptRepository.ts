import { DiscountType, SaleStatus } from "@server/generated/prisma/client";
import {
  createLegacyReceiptSnapshot,
  parseReceiptSnapshot,
  type ReceiptSnapshot,
  type ReceiptStoreSnapshot,
} from "@/lib/receipt";
import { prisma } from "./prisma";
import { readStoreProfile } from "./storeProfileRepository";

export class ReceiptNotFoundError extends Error {}
export class ReceiptNotPrintableError extends Error {}

export type PaidReceipt = {
  snapshot: ReceiptSnapshot;
  isLegacy: boolean;
};

export async function readPaidReceipt(saleId: string): Promise<PaidReceipt> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      owner: { select: { name: true } },
      pharmacist: { select: { name: true } },
      lines: { orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });
  if (!sale) throw new ReceiptNotFoundError("ไม่พบใบเสร็จ");
  if (sale.status !== SaleStatus.PAID) {
    throw new ReceiptNotPrintableError("พิมพ์ใบเสร็จได้เฉพาะรายการที่ชำระเงินแล้ว");
  }
  if (sale.receiptSnapshot !== null) {
    const snapshot = parseReceiptSnapshot(sale.receiptSnapshot);
    if (!snapshot || snapshot.saleId !== sale.id || snapshot.billNo !== sale.billNo) {
      throw new ReceiptNotPrintableError("ข้อมูลใบเสร็จที่บันทึกไว้ไม่สมบูรณ์");
    }
    return { snapshot, isLegacy: false };
  }

  const profile = await readStoreProfile();
  const store: ReceiptStoreSnapshot = {
    storeName: profile.storeName,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    taxId: profile.taxId,
    lineId: profile.lineId,
    facebookPage: profile.facebookPage,
    openingTime: profile.openingTime,
    closingTime: profile.closingTime,
  };
  const billDiscount = sale.discountType
    ? {
        type: sale.discountType === DiscountType.PERCENT ? "percent" as const : "thb" as const,
        value: Number(sale.discountValue ?? 0),
      }
    : null;
  try {
    return {
      isLegacy: true,
      snapshot: createLegacyReceiptSnapshot({
        saleId: sale.id,
        billNo: sale.billNo,
        soldAt: sale.soldAt.toISOString(),
        customerName: sale.customerName,
        salespersonName: sale.pharmacist?.name || sale.owner?.name || "ไม่ระบุ",
        paymentMethod: sale.paymentMethod,
        customerPaid: Number(sale.customerPaid ?? sale.netTotal),
        changeDue: Number(sale.changeDue ?? 0),
        netTotal: Number(sale.netTotal),
        billDiscount,
        store,
        lines: sale.lines.map((line, index) => ({
          position: line.position ?? index,
          itemName: line.itemName,
          quantity: Number(line.quantity),
          originalUnitPrice: Number(line.sellPriceThb) * Number(line.packMultiplier),
        })),
      }),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Store Profile")) {
      throw new ReceiptNotPrintableError("กรุณากรอกชื่อร้าน ที่อยู่ โทรศัพท์ เลขประจำตัวผู้เสียภาษี และเวลาเปิด-ปิดร้านให้ครบ");
    }
    throw new ReceiptNotPrintableError("ข้อมูลรายการขายเดิมไม่เพียงพอสำหรับสร้างใบเสร็จ");
  }
}
