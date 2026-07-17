import { randomUUID } from "node:crypto";
import { DiscountType, Prisma, SaleStatus } from "@/generated/prisma/client";
import { calculateSalePricing } from "@/lib/salePricing";
import { createReceiptSnapshot, type ReceiptStoreSnapshot } from "@/lib/receipt";
import type { SalesProduct } from "./types";
import { prisma } from "./prisma";
import { readStoreProfile } from "./storeProfileRepository";
import {
  dispenseSoldStock,
  readStockProducts,
  type SoldStockLineInput,
} from "./stockRepository";

export type SaleLineInput = {
  lineId: string;
  itemId: string;
  itemName: string;
  packLabel: string;
  packMultiplier: number;
  loc: string;
  batch: {
    batchId?: string;
    batchNo: string;
    exp: string;
    sellPrice: number;
    stock?: number;
  };
  qty: number;
};

export type SaleInput = {
  id?: string;
  billNo?: string;
  owner?: { id: string; name: string };
  pharmacist?: { id: string; name: string };
  customer?: { id: string; name: string; mobile?: string; isMember?: boolean } | null;
  paymentMethod: string;
  purchaseMethod: string;
  subtotal: number;
  netPayable: number;
  customerPaid?: number | null;
  changeDue?: number | null;
  discount?: { type: "percent" | "thb"; value: number } | null;
  status: "paid" | "pending";
  lines: SaleLineInput[];
};

export type SavedSaleResult = {
  id: string;
  billNo: string;
  date: string;
  status: "paid" | "pending";
};

export type SaveSaleResult = {
  sale: SavedSaleResult;
  products: SalesProduct[] | null;
};

export type SavedSale = {
  id: string;
  billNo: string;
  date: string;
  customerName: string;
  customerMobile: string;
  isMember: boolean;
  itemCount: number;
  paymentMethod: string;
  purchaseMethod: string;
  netTotal: number;
  status: "paid" | "pending" | "void";
  ownerId: string | null;
  billDate: string;
  pharmacistId: string | null;
  customerId: string | null;
  lines: SaleLineInput[];
  discount: { type: "percent" | "thb"; value: number } | null;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function createBillIdentity(input: SaleInput, now: Date) {
  const randomSuffix = randomUUID();
  return {
    id: input.id?.trim() || `sale-${randomSuffix}`,
    billNo: input.billNo?.trim() || `INV-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${randomSuffix.slice(0, 8).toUpperCase()}`,
  };
}

export function validateSale(input: SaleInput) {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("A sale requires at least one item.");
  }
  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) {
    throw new Error("Sale subtotal is invalid.");
  }
  if (!Number.isFinite(input.netPayable) || input.netPayable <= 0) {
    throw new Error("Sale net payable is invalid.");
  }
  if (!input.paymentMethod?.trim() || !input.purchaseMethod?.trim()) {
    throw new Error("Payment and purchase methods are required.");
  }
  const hasInvalidLine = input.lines.some((line) => (
    !line?.lineId?.trim()
    || !line.itemId?.trim()
    || !line.itemName?.trim()
    || !line.batch?.batchNo?.trim()
    || !Number.isFinite(Number(line.qty))
    || Number(line.qty) <= 0
    || !Number.isInteger(Number(line.qty))
    || !Number.isFinite(Number(line.packMultiplier))
    || Number(line.packMultiplier) <= 0
    || !Number.isFinite(Number(line.batch.sellPrice))
    || Number(line.batch.sellPrice) < 0
  ));
  if (hasInvalidLine) throw new Error("One or more sale items are invalid.");
  if (input.status === "paid") {
    const customerPaid = Number(input.customerPaid);
    if (!Number.isFinite(customerPaid) || customerPaid < input.netPayable) {
      throw new Error("Customer payment must cover the net payable amount.");
    }
  }
  if (input.discount && (!Number.isFinite(input.discount.value) || input.discount.value <= 0)) {
    throw new Error("Sale discount is invalid.");
  }
}

function stockLines(lines: SaleLineInput[]): SoldStockLineInput[] {
  return lines.map((line) => ({
    productId: line.itemId.trim(),
    batchNo: line.batch.batchNo.trim(),
    quantity: Number(line.qty),
    unitMultiplier: Number(line.packMultiplier),
  }));
}

async function upsertPeople(tx: Prisma.TransactionClient, input: SaleInput) {
  if (input.owner?.id && input.owner.name) {
    await tx.owner.upsert({
      where: { id: input.owner.id },
      update: { name: input.owner.name },
      create: { id: input.owner.id, name: input.owner.name },
    });
  }
  if (input.pharmacist?.id && input.pharmacist.name) {
    await tx.pharmacist.upsert({
      where: { id: input.pharmacist.id },
      update: { name: input.pharmacist.name },
      create: { id: input.pharmacist.id, name: input.pharmacist.name },
    });
  }
  if (input.customer?.id && input.customer.name) {
    await tx.customer.upsert({
      where: { id: input.customer.id },
      update: {
        name: input.customer.name,
        mobile: input.customer.mobile?.trim() || null,
        isMember: Boolean(input.customer.isMember),
      },
      create: {
        id: input.customer.id,
        name: input.customer.name,
        mobile: input.customer.mobile?.trim() || null,
        isMember: Boolean(input.customer.isMember),
      },
    });
  }
}

export async function saveSale(input: SaleInput): Promise<SaveSaleResult> {
  validateSale(input);
  const now = new Date();
  const identity = createBillIdentity(input, now);
  const nextStatus = input.status === "paid" ? SaleStatus.PAID : SaleStatus.PENDING;
  const storeProfile = nextStatus === SaleStatus.PAID ? await readStoreProfile() : null;

  const sale = await prisma.$transaction(async (tx) => {
    const existingSale = await tx.sale.findUnique({ where: { id: identity.id } });
    if (existingSale?.status === SaleStatus.PAID) {
      if (nextStatus === SaleStatus.PAID) return existingSale;
      throw new Error("A paid sale cannot be changed.");
    }

    const productIds = [...new Set(input.lines.map((line) => line.itemId.trim()))];
    const pricedProducts = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, discountPercent: true },
    });
    if (pricedProducts.length !== productIds.length) throw new Error("Sale item was not found in stock.");
    const discountByProduct = new Map(pricedProducts.map((product) => [product.id, product.discountPercent]));
    const pricing = calculateSalePricing(input.lines.map((line) => ({
      quantity: Number(line.qty),
      unitPrice: Number(line.batch.sellPrice) * Number(line.packMultiplier),
      discountPercent: discountByProduct.get(line.itemId.trim()) ?? 0,
    })), input.discount ?? null);
    validateSale({
      ...input,
      subtotal: pricing.grossSubtotal,
      netPayable: pricing.netPayable,
    });
    const canonicalCustomerPaid = nextStatus === SaleStatus.PAID ? roundCurrency(Number(input.customerPaid)) : null;
    const canonicalChangeDue = canonicalCustomerPaid === null
      ? null
      : roundCurrency(Math.max(canonicalCustomerPaid - pricing.netPayable, 0));

    await upsertPeople(tx, input);
    const receiptSnapshot = storeProfile ? createReceiptSnapshot({
      saleId: identity.id,
      billNo: identity.billNo,
      soldAt: now.toISOString(),
      customerName: input.customer?.name || "Walk-in Customer",
      salespersonName: input.pharmacist?.name?.trim() || input.owner?.name?.trim() || "ไม่ระบุ",
      paymentMethod: input.paymentMethod,
      customerPaid: canonicalCustomerPaid ?? 0,
      changeDue: canonicalChangeDue ?? 0,
      billDiscountAmount: pricing.billDiscountAmount,
      expectedNetTotal: pricing.netPayable,
      store: {
        storeName: storeProfile.storeName,
        address: storeProfile.address,
        phone: storeProfile.phone,
        email: storeProfile.email,
        taxId: storeProfile.taxId,
        lineId: storeProfile.lineId,
        facebookPage: storeProfile.facebookPage,
        openingTime: storeProfile.openingTime,
        closingTime: storeProfile.closingTime,
      } satisfies ReceiptStoreSnapshot,
      lines: input.lines.map((line, position) => ({
        position,
        itemName: line.itemName,
        quantity: Number(line.qty),
        originalUnitPrice: Number(line.batch.sellPrice) * Number(line.packMultiplier),
        discountPercent: discountByProduct.get(line.itemId.trim()) ?? 0,
      })),
    }) : null;
    if (nextStatus === SaleStatus.PAID) {
      await dispenseSoldStock(tx, stockLines(input.lines));
    }

    const discountType = input.discount?.type === "percent"
      ? DiscountType.PERCENT
      : input.discount?.type === "thb"
        ? DiscountType.THB
        : null;
    const saleData = {
      billNo: identity.billNo,
      soldAt: now,
      customerId: input.customer?.id || null,
      customerName: input.customer?.name || "Walk-in Customer",
      isMember: Boolean(input.customer?.isMember),
      itemCount: input.lines.length,
      totalQuantity: input.lines.reduce((sum, line) => sum + Number(line.qty), 0),
      paymentMethod: input.paymentMethod.trim(),
      purchaseMethod: input.purchaseMethod.trim(),
      subtotal: pricing.grossSubtotal,
      netTotal: pricing.netPayable,
      customerPaid: canonicalCustomerPaid,
      changeDue: canonicalChangeDue,
      status: nextStatus,
      ownerId: input.owner?.id || null,
      pharmacistId: input.pharmacist?.id || null,
      discountType,
      discountValue: input.discount?.value ?? null,
      receiptSnapshot: receiptSnapshot
        ? receiptSnapshot as unknown as Prisma.InputJsonValue
        : Prisma.DbNull,
    };

    if (existingSale) {
      await tx.saleLine.deleteMany({ where: { saleId: identity.id } });
    }

    return tx.sale.upsert({
      where: { id: identity.id },
      update: {
        ...saleData,
        lines: { create: input.lines.map((line, position) => ({
          id: line.lineId,
          productId: line.itemId,
          itemName: line.itemName,
          packLabel: line.packLabel,
          packMultiplier: line.packMultiplier,
          location: line.loc,
          batchNo: line.batch.batchNo,
          expiryDate: line.batch.exp,
          sellPriceThb: line.batch.sellPrice,
          quantity: line.qty,
          position,
        })) },
      },
      create: {
        id: identity.id,
        ...saleData,
        lines: { create: input.lines.map((line, position) => ({
          id: line.lineId,
          productId: line.itemId,
          itemName: line.itemName,
          packLabel: line.packLabel,
          packMultiplier: line.packMultiplier,
          location: line.loc,
          batchNo: line.batch.batchNo,
          expiryDate: line.batch.exp,
          sellPriceThb: line.batch.sellPrice,
          quantity: line.qty,
          position,
        })) },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return {
    sale: {
      id: sale.id,
      billNo: sale.billNo,
      date: sale.soldAt.toISOString(),
      status: sale.status === SaleStatus.PAID ? "paid" : "pending",
    },
    products: input.status === "paid" ? await readStockProducts() : null,
  };
}

export async function readSales(): Promise<SavedSale[]> {
  const sales = await prisma.sale.findMany({
    include: {
      customer: { select: { mobile: true } },
      lines: {
        include: { product: { include: { batches: true } } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { soldAt: "desc" },
    take: 100,
  });

  return sales.map((sale) => ({
    id: sale.id,
    billNo: sale.billNo,
    date: sale.soldAt.toISOString(),
    customerName: sale.customerName,
    customerMobile: sale.customer?.mobile ?? "",
    isMember: sale.isMember,
    itemCount: sale.itemCount,
    paymentMethod: sale.paymentMethod,
    purchaseMethod: sale.purchaseMethod,
    netTotal: Number(sale.netTotal),
    status: sale.status === SaleStatus.PAID
      ? "paid"
      : sale.status === SaleStatus.VOIDED
        ? "void"
        : "pending",
    ownerId: sale.ownerId,
    billDate: sale.soldAt.toISOString().slice(0, 10),
    pharmacistId: sale.pharmacistId,
    customerId: sale.customerId,
    lines: sale.lines.map((line) => ({
      lineId: line.id,
      itemId: line.productId,
      itemName: line.itemName,
      packLabel: line.packLabel,
      packMultiplier: Number(line.packMultiplier),
      loc: line.location,
      batch: {
        batchId: `${line.productId}-${line.batchNo}`,
        batchNo: line.batchNo,
        exp: line.expiryDate,
        sellPrice: Number(line.sellPriceThb),
        stock: Number(line.product.batches.find((batch) => batch.batchNo === line.batchNo)?.availableStock ?? 0),
      },
      qty: Number(line.quantity),
    })),
    discount: sale.discountType
      ? {
          type: sale.discountType === DiscountType.PERCENT ? "percent" : "thb",
          value: Number(sale.discountValue ?? 0),
        }
      : null,
  }));
}
